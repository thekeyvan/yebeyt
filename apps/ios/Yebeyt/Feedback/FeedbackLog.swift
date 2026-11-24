import Foundation
import Network

/// What a bug report may know about the last minutes, kept in memory only and never written anywhere: the screens
/// visited (names from `ScreenName`, never text) and the codes of the errors shown to the person (never messages).
/// Each is a small ring: only the last 20 are kept.
@MainActor
final class FeedbackLog {
    static let shared = FeedbackLog()
    static let limit = TechnicalInfo.listLimit

    private(set) var steps: [ScreenName] = []
    private(set) var errors: [String] = []
    /// The reader that is open, for the couplet, the mode and the recitation position of a bug report.
    weak var reader: ReaderModel?

    func visit(_ screen: ScreenName) {
        guard steps.last != screen else { return }
        steps.append(screen)
        steps = Array(steps.suffix(Self.limit))
    }

    /// The UI error boundary: the screens that show an API error's Persian line call this.
    func record(_ error: APIError) {
        errors.append(Self.code(of: error))
        errors = Array(errors.suffix(Self.limit))
    }

    /// The line to show for an API error, noting its code on the way.
    func shown(_ error: APIError) -> String {
        record(error)
        return error.persianMessage
    }

    /// «429 rate_limited», «network»: a code, never the message or anything the server said besides its code.
    static func code(of error: APIError) -> String {
        switch error {
        case .network: "network"
        case .badResponse: "bad_response"
        case .busy: "503 busy"
        case .server(let status, let code, _): "\(status) \(code?.rawValue ?? "unknown")"
        }
    }
}

/// wifi, cellular or offline, watched with `NWPathMonitor`.
final class NetworkMonitor: @unchecked Sendable {
    static let shared = NetworkMonitor()

    private let monitor = NWPathMonitor()
    private let lock = NSLock()
    private var kind = NetworkKind.unknown

    var current: NetworkKind { lock.withLock { kind } }

    func start() {
        monitor.pathUpdateHandler = { [self] path in
            let kind = NetworkKind(satisfied: path.status == .satisfied, wifi: path.usesInterfaceType(.wifi), cellular: path.usesInterfaceType(.cellular))
            lock.withLock { self.kind = kind }
        }
        monitor.start(queue: DispatchQueue(label: "yebeyt.network"))
    }
}
