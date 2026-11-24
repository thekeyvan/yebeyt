import Foundation

/// Sends a report: `POST /v1/feedback` (with the session when signed in, without it as a guest), then the screenshot and
/// the recording with the upload token. One sender belongs to one draft: when something fails half way, sending again
/// carries on where it stopped and never makes a second report.
@MainActor
final class FeedbackSender {
    struct Files {
        var screenshot: Data?
        var recording: URL?
    }

    enum Outcome: Equatable {
        case sent
        /// The line to show; the button stays so the person can send again.
        case failed(String)
    }

    static let thanks = "رسید، ممنون!"
    static let offlineLine = "الان نرسید، وقتی اینترنت اومد دوباره بفرست"
    static let rateLine = "یه کم بعد دوباره بفرست"
    static let busyLine = "الان سرور شلوغه؛ یه کم بعد دوباره بفرست"
    private static let maxRetryAfter = 10

    private let session: Session
    private let log: FeedbackLog
    private let pause: (Int) async -> Void
    private var created: FeedbackCreated?
    private var screenshotSent = false
    private var recordingSent = false

    /// The report is already on the server: only the files are still on the way.
    var hasCreatedReport: Bool { created != nil }

    init(session: Session, log: FeedbackLog = .shared, pause: @escaping (Int) async -> Void = { try? await Task.sleep(for: .seconds($0)) }) {
        self.session = session
        self.log = log
        self.pause = pause
    }

    func send(_ payload: FeedbackPayload, files: Files) async -> Outcome {
        do {
            if created == nil { created = try await post(payload) }
            guard let created else { return .failed(APIError.badResponse.persianMessage) }
            if let data = files.screenshot, !screenshotSent {
                try await attach(.screenshot, data, to: created)
                screenshotSent = true
            }
            if let url = files.recording, !recordingSent {
                if let data = try? Data(contentsOf: url, options: .mappedIfSafe) { try await attach(.recording, data, to: created) }
                recordingSent = true
            }
            return .sent
        } catch let error as APIError {
            log.record(error)
            return .failed(Self.line(for: error))
        } catch {
            return .failed(APIError.badResponse.persianMessage)
        }
    }

    static func line(for error: APIError) -> String {
        switch error {
        case .network: offlineLine
        case .busy: busyLine
        case .server(let status, _, _) where status == 408: offlineLine
        case .server(let status, _, _) where status == 429: rateLine
        default: error.persianMessage
        }
    }

    /// A signed-in person's report carries the user; one whose sign-in the server refuses is sent as a guest's.
    private func post(_ payload: FeedbackPayload) async throws -> FeedbackCreated {
        let api = session.api
        guard session.isSignedIn else { return try await api.postFeedback(payload, token: nil) }
        do {
            return try await session.authorized { try await api.postFeedback(payload, token: $0) }
        } catch let error as APIError where error.isUnauthorized {
            return try await api.postFeedback(payload, token: nil)
        }
    }

    /// Busy servers are asked once more after their `Retry-After`. A file the server will never take (too big, the
    /// wrong kind, a token that ran out) or already has is left out: the report itself has arrived.
    private func attach(_ kind: FeedbackAttachment, _ data: Data, to report: FeedbackCreated) async throws {
        let api = session.api
        do {
            do {
                try await api.uploadAttachment(kind, reportID: report.id, uploadToken: report.uploadToken, data: data)
            } catch APIError.busy(let seconds) {
                await pause(min(max(seconds, 1), Self.maxRetryAfter))
                try await api.uploadAttachment(kind, reportID: report.id, uploadToken: report.uploadToken, data: data)
            }
        } catch let error as APIError {
            guard case .server(let status, _, _) = error, [400, 403, 404, 409, 413, 415].contains(status) else { throw error }
            log.record(error)
        }
    }
}
