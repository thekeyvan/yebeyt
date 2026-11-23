import Foundation
import Observation

/// The state of the username field: the local rules answer at once, the server is asked 300 ms after the last
/// keystroke (so typing «niloofar» is one question, not eight).
@MainActor @Observable
final class UsernameAvailability {
    enum State: Equatable {
        case idle
        case checking
        case available
        case unavailable(UsernameRules.Problem)
        /// The question could not be asked; the line says why.
        case failed(String)
    }

    private(set) var state = State.idle
    var text = "" {
        didSet { if text != oldValue { textChanged() } }
    }

    @ObservationIgnored private let check: @MainActor (String) async throws -> UsernameCheck
    @ObservationIgnored private let sleep: @MainActor (Duration) async throws -> Void
    @ObservationIgnored private let debounce: Duration
    /// The user's current username: it is free for them.
    @ObservationIgnored private let own: String?
    @ObservationIgnored private var task: Task<Void, Never>?

    init(
        own: String? = nil, debounce: Duration = .milliseconds(300),
        sleep: @escaping @MainActor (Duration) async throws -> Void = { try await Task.sleep(for: $0) },
        check: @escaping @MainActor (String) async throws -> UsernameCheck
    ) {
        self.own = own
        self.debounce = debounce
        self.sleep = sleep
        self.check = check
    }

    /// The name as it would be saved.
    var normalized: String { UsernameRules.normalize(text) }

    var isAvailable: Bool { state == .available }

    private func textChanged() {
        task?.cancel()
        let name = normalized
        if name.isEmpty {
            state = .idle
        } else if let problem = UsernameRules.problem(name) {
            state = .unavailable(problem)
        } else if name == own {
            state = .available
        } else {
            state = .checking
            task = Task { [self] in
                do {
                    try await sleep(debounce)
                    let answer = try await check(name)
                    try Task.checkCancellation()
                    state = answer.available ? .available : .unavailable(answer.reason.flatMap(UsernameRules.Problem.init(rawValue:)) ?? .taken)
                } catch is CancellationError {
                    return
                } catch {
                    guard !Task.isCancelled else { return }
                    state = .failed((error as? APIError)?.persianMessage ?? APIError.badResponse.persianMessage)
                }
            }
        }
    }
}
