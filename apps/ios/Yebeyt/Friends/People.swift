import Foundation
import Observation

/// «پیدا کردن دوست»: people by the start of their username. The search waits for a short pause in typing, and an
/// answer that arrives after the text changed is dropped.
@MainActor @Observable
final class PeopleSearchModel {
    enum Phase: Equatable {
        case idle, loading, loaded
        case failed(String)
    }

    /// The server wants at least two characters.
    static let shortestQuery = 2

    var people: [FoundPerson] = []
    var pending: Set<String> = []
    private(set) var phase = Phase.idle
    let session: Session
    @ObservationIgnored private let debounce: Duration
    /// Told what changed, so the requests row and the badge follow.
    @ObservationIgnored private weak var center: MessagesCenter?
    @ObservationIgnored private var task: Task<Void, Never>?

    init(session: Session, debounce: Duration = .milliseconds(300), center: MessagesCenter? = nil) {
        self.session = session
        self.debounce = debounce
        self.center = center
    }

    /// What is searched for: without spaces or a leading «@», in lowercase (usernames are).
    static func normalized(_ text: String) -> String {
        var name = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.hasPrefix("@") { name.removeFirst() }
        return name.lowercased()
    }

    /// The text of the field changed.
    func queryChanged(_ text: String) {
        task?.cancel()
        let query = Self.normalized(text)
        guard query.count >= Self.shortestQuery else {
            people = []
            phase = .idle
            return
        }
        phase = .loading
        let wait = debounce
        task = Task { [self] in
            try? await Task.sleep(for: wait)
            guard !Task.isCancelled else { return }
            do {
                let api = session.api
                let found = try await session.authorized { try await api.searchUsers(query, token: $0) }
                guard !Task.isCancelled else { return }
                people = found
                phase = .loaded
            } catch is CancellationError {
                return
            } catch {
                guard !Task.isCancelled else { return }
                people = []
                phase = .failed(FeedbackLog.shared.shown(error as? APIError ?? .badResponse))
            }
        }
    }

    /// Waits for the search in flight (for tests).
    func settle() async {
        await task?.value
    }

    /// Does `action` to the row of `username`: the row changes at once and goes back when the server refuses. Returns
    /// the line to show when it failed.
    func perform(_ action: FriendAction, on username: String) async -> String? {
        guard !pending.contains(username), let index = people.firstIndex(where: { $0.username == username }), people[index].friendship == action.requires else { return nil }
        pending.insert(username)
        people[index].friendship = action.result
        defer { pending.remove(username) }
        do {
            let api = session.api
            let state = try await session.authorized { try await api.friendAction(action, username: username, token: $0) }
            if let now = people.firstIndex(where: { $0.username == username }) { people[now].friendship = state }
            center?.friendshipChanged(username, action: action, state: state)
            return nil
        } catch {
            if let now = people.firstIndex(where: { $0.username == username }) { people[now].friendship = action.requires }
            return FriendCopy.toast(for: error as? APIError ?? .badResponse)
        }
    }
}

/// My friends (`/v1/me/friends`), a page at a time.
@MainActor @Observable
final class FriendsListModel {
    enum Phase: Equatable {
        case loading, loaded
        case failed(String)
    }

    private(set) var people: [FoundPerson] = []
    private(set) var phase = Phase.loading
    let session: Session
    @ObservationIgnored private var nextCursor: String?
    @ObservationIgnored private var isLoadingMore = false

    init(session: Session) {
        self.session = session
    }

    var hasMore: Bool { nextCursor != nil }

    func load() async {
        guard people.isEmpty else { return }
        await fetch(cursor: nil)
    }

    /// The next page; when everything on it is hidden (blocked), the one after it is asked for too.
    func loadMore(hiding blocked: BlockedPeople) async {
        guard !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        while let cursor = nextCursor {
            let before = people.count
            await fetch(cursor: cursor)
            if nextCursor == cursor { return }  // it failed
            if !blocked.visible(Array(people.dropFirst(before))).isEmpty { return }
        }
    }

    /// Someone just accepted or asked (a live event): the first page is read again and replaces the list.
    func reload() async {
        guard phase == .loaded else { return }
        let api = session.api
        guard let page = try? await session.authorized({ try await api.friends(cursor: nil, token: $0) }) else { return }
        people = Self.found(page.items)
        nextCursor = page.nextCursor
    }

    private static func found(_ items: [PersonShort]) -> [FoundPerson] {
        items.map { FoundPerson(username: $0.username, displayName: $0.displayName, avatar: $0.avatar, friendship: .friends) }
    }

    private func fetch(cursor: String?) async {
        do {
            let api = session.api
            let page = try await session.authorized { try await api.friends(cursor: cursor, token: $0) }
            people += Self.found(page.items.filter { new in !people.contains { $0.username == new.username } })
            nextCursor = page.nextCursor
            phase = .loaded
        } catch {
            if cursor == nil { phase = .failed(FeedbackLog.shared.shown(error as? APIError ?? .badResponse)) }
        }
    }
}
