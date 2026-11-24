import Foundation
import Observation

/// Another person's page: their public profile, following them, blocking and reporting.
@MainActor @Observable
final class PersonModel {
    enum Phase: Equatable {
        case loading, loaded, notFound
        case failed(String)
    }

    /// Why someone is reported: the three the server knows.
    enum Reason: CaseIterable, Sendable {
        case spam, abuse, other

        var title: String {
            switch self {
            case .spam: "اسپم"
            case .abuse: "بی‌احترامی"
            case .other: "یه چیز دیگه"
            }
        }

        var wire: ReportRequest.Reason {
            switch self {
            case .spam: .spam
            case .abuse: .abuse
            case .other: .other
            }
        }
    }

    let username: String
    private(set) var profile: PublicProfile?
    private(set) var phase = Phase.loading
    private(set) var isFollowPending = false
    /// A short message for the person (a failed follow, «گزارشت رسید»).
    var toast: String?
    @ObservationIgnored private let session: Session

    init(username: String, session: Session) {
        self.username = username
        self.session = session
    }

    var name: String { profile?.short.name ?? username }

    /// «پیام بده» shows when the server says I may write to them.
    var canMessage: Bool { profile?.canMessage == true }

    /// The server takes 500 code points (not graphemes or UTF-16 units) of the note.
    static let noteLimit = 500

    static func clipped(_ note: String) -> String {
        String(String.UnicodeScalarView(note.unicodeScalars.prefix(noteLimit)))
    }

    func load() async {
        let api = session.api
        let username = username
        do {
            profile = try await session.authorized { try await api.profile(username: username, token: $0) }
            phase = .loaded
        } catch let error as APIError where error.code == .notFound {
            phase = .notFound
        } catch {
            if profile == nil { phase = .failed(FeedbackLog.shared.shown(error as? APIError ?? .badResponse)) }
        }
    }

    func toggleFollow() async {
        guard var current = profile, !isFollowPending else { return }
        isFollowPending = true
        defer { isFollowPending = false }
        let api = session.api
        let username = username
        let on = !current.isFollowing
        do {
            let relation = try await session.authorized { try await api.follow(username, on: on, token: $0) }
            current.isFollowing = relation.isFollowing
            current.followsYou = relation.followsYou
            current.isFriend = relation.isFriend
            profile = current
            await load()  // the friends count and the league follow the relationship
        } catch {
            toast = FeedbackLog.shared.shown(error as? APIError ?? .badResponse)
        }
    }

    /// «بلاک کن». Returns whether it went through (the page then closes).
    func block() async -> Bool {
        let api = session.api
        let username = username
        do {
            try await session.authorized { try await api.block(username, token: $0) }
            return true
        } catch {
            toast = FeedbackLog.shared.shown(error as? APIError ?? .badResponse)
            return false
        }
    }

    /// Sends the report. Returns whether it went through (the sheet then closes and the toast thanks).
    func report(_ reason: Reason, note: String) async -> Bool {
        let api = session.api
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = ReportRequest(username: username, reason: reason.wire, note: text.isEmpty ? nil : Self.clipped(text))
        do {
            try await session.authorized { try await api.report(request, token: $0) }
            toast = "گزارشت رسید"
            return true
        } catch {
            toast = FeedbackLog.shared.shown(error as? APIError ?? .badResponse)
            return false
        }
    }
}
