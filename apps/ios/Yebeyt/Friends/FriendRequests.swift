import Foundation
import Observation

/// The requests I got and the ones I sent. The count of the incoming ones is the number on the inbox row and in
/// the tab badge: the server's number until the list is read, then the list's.
@MainActor @Observable
final class FriendRequestsModel {
    enum Phase: Equatable {
        case loading, loaded
        case failed(String)
    }

    private(set) var incoming: [FriendRequest] = []
    private(set) var outgoing: [FriendRequest] = []
    private(set) var phase = Phase.loading
    private(set) var incomingCount = 0 {
        didSet { if incomingCount != oldValue { onCountChange?(incomingCount) } }
    }
    /// The people whose answer is on its way: a second tap waits.
    private(set) var pending: Set<String> = []
    /// The requests screen is showing: a reconnect reads the lists again.
    var isVisible = false
    /// Told when the incoming count changes (the tab bar's badge).
    @ObservationIgnored var onCountChange: (@MainActor (Int) -> Void)?

    @ObservationIgnored private let session: Session

    init(session: Session) {
        self.session = session
    }

    /// The server's count of incoming requests (`/v1/me/unread`).
    func setCount(_ count: Int) {
        incomingCount = count
    }

    /// Both lists, every page. A failure keeps what is shown.
    func load() async {
        if incoming.isEmpty, outgoing.isEmpty { phase = .loading }
        do {
            let received = try await all(.incoming)
            let sent = try await all(.outgoing)
            incoming = received
            outgoing = sent
            incomingCount = received.count
            phase = .loaded
        } catch {
            if phase != .loaded { phase = .failed(FeedbackLog.shared.shown(error as? APIError ?? .badResponse)) }
        }
    }

    private func all(_ direction: FriendRequestDirection) async throws -> [FriendRequest] {
        var found: [FriendRequest] = []
        var cursor: String?
        let api = session.api
        repeat {
            let page = try await session.authorized { [cursor] in try await api.friendRequests(direction, cursor: cursor, token: $0) }
            found += page.items
            cursor = page.nextCursor
        } while cursor != nil
        return found
    }

    /// «قبول» and «رد» on a request I got, «لغو» on one I sent: the row goes at once and comes back where it was when
    /// the server refuses. Returns the line to show when it failed.
    func perform(_ action: FriendAction, on username: String) async -> String? {
        guard !pending.contains(username), action != .send, action != .unfriend else { return nil }
        let wasIncoming = action == .accept || action == .reject
        guard let index = (wasIncoming ? incoming : outgoing).firstIndex(where: { $0.username == username }) else { return nil }
        pending.insert(username)
        defer { pending.remove(username) }
        let row = remove(username, incoming: wasIncoming)
        do {
            let api = session.api
            _ = try await session.authorized { try await api.friendAction(action, username: username, token: $0) }
            return nil
        } catch {
            if let row { restore(row, at: index, incoming: wasIncoming) }
            return FriendCopy.toast(for: error as? APIError ?? .badResponse)
        }
    }

    private func remove(_ username: String, incoming isIncoming: Bool) -> FriendRequest? {
        if isIncoming {
            guard let index = incoming.firstIndex(where: { $0.username == username }) else { return nil }
            incomingCount -= 1
            return incoming.remove(at: index)
        }
        guard let index = outgoing.firstIndex(where: { $0.username == username }) else { return nil }
        return outgoing.remove(at: index)
    }

    private func restore(_ row: FriendRequest, at index: Int, incoming isIncoming: Bool) {
        if isIncoming {
            incoming.insert(row, at: min(index, incoming.count))
            incomingCount += 1
        } else {
            outgoing.insert(row, at: min(index, outgoing.count))
        }
    }

    /// Live `friend.request`: a new row on top (the same request twice changes nothing).
    func received(from person: PersonShort) {
        guard !incoming.contains(where: { $0.username == person.username }) else { return }
        incoming.insert(
            FriendRequest(username: person.username, displayName: person.displayName, avatar: person.avatar, createdAt: ServerTime.string(from: .now)), at: 0
        )
        incomingCount += 1
    }

    /// I answered (or answered by asking back) the request of `username` somewhere other than this screen: the row goes,
    /// or, when the list was not read, the count is one less.
    func answered(_ username: String) {
        if incoming.contains(where: { $0.username == username }) {
            incoming.removeAll { $0.username == username }
        }
        incomingCount = max(incomingCount - 1, 0)
    }

    /// I blocked `username`: no request of theirs or mine stays in the lists.
    func removeAll(of username: String) {
        if incoming.contains(where: { $0.username == username }) { answered(username) }
        removeSent(to: username)
    }

    /// Live `friend.accepted`: the request I sent is no longer waiting.
    func removeSent(to username: String) {
        outgoing.removeAll { $0.username == username }
    }

    /// Signed out: nothing of the account stays in memory.
    func reset() {
        incoming = []
        outgoing = []
        pending = []
        phase = .loading
        incomingCount = 0
    }
}
