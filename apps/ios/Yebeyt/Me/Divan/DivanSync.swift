import Foundation
import Observation

/// Keeps the divan on the phone and on the server the same, for a signed-in person: the server's divan is read and
/// merged into the phone's (the last change per couplet wins, as the server does it), and what the server lacks
/// or has older goes up in batches of at most 2000. It runs when someone signs in, when the app comes to the
/// front, and two seconds after the last keep or un-keep. A guest's divan stays on the phone. A failed run is not
/// shown; the next one tries again.
@MainActor @Observable
final class DivanSync {
    /// The most items the server takes in one request.
    static let batchSize = 2000

    @ObservationIgnored private let marks: ReaderMarks
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let debounce: Duration
    @ObservationIgnored private var scheduled: Task<Void, Never>?
    @ObservationIgnored private var running: Task<Bool, Never>?
    @ObservationIgnored private var runAgain = false

    init(marks: ReaderMarks, session: Session, debounce: Duration = .seconds(2)) {
        self.marks = marks
        self.session = session
        self.debounce = debounce
        marks.keptDidChange = { [weak self] in self?.scheduleSync() }
    }

    /// Cancels a waiting sync and waits for the one running, so nothing lands after the divan is cleared.
    func stop() async {
        scheduled?.cancel()
        scheduled = nil
        _ = await running?.value
    }

    /// Runs a sync after the debounce; asking again meanwhile starts the wait over.
    func scheduleSync() {
        guard session.isSignedIn else { return }
        scheduled?.cancel()
        let wait = debounce
        scheduled = Task { [weak self] in
            try? await Task.sleep(for: wait)
            guard !Task.isCancelled else { return }
            await self?.syncNow()
        }
    }

    /// Pull, merge, push. A call while one is running makes it go around once more, and waits for it to end.
    /// Returns whether the last round went through (true too when there is no account to sync).
    @discardableResult
    func syncNow() async -> Bool {
        guard session.isSignedIn else { return true }
        if let running {
            runAgain = true
            return await running.value
        }
        let task = Task { [self] () -> Bool in
            var succeeded = true
            repeat {
                runAgain = false
                do { try await runOnce(); succeeded = true } catch { succeeded = false }
            } while runAgain
            return succeeded
        }
        running = task
        let result = await task.value
        running = nil
        return result
    }

    private func runOnce() async throws {
        let session = session
        let api = session.api
        let server = try await session.authorized { try await api.divan(token: $0) }
        marks.apply(server)
        let known = Dictionary(server.map { ($0.key, $0) }, uniquingKeysWith: { $0.merged(with: $1) })
        let missing = marks.divanItems.filter { known[$0.key] != $0 }
        for start in stride(from: 0, to: missing.count, by: Self.batchSize) {
            let batch = Array(missing[start..<min(start + Self.batchSize, missing.count)])
            marks.apply(try await session.authorized { try await api.putDivan(batch, token: $0) })
        }
    }
}
