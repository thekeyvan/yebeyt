import Foundation
import Observation

/// A list of people with a «دنبال کن» button on each row (a search, my friends).
@MainActor
protocol FollowList: AnyObject {
    var people: [FoundPerson] { get set }
    var session: Session { get }
    /// The usernames whose follow call is on its way: a second tap waits.
    var pending: Set<String> { get set }
}

extension FollowList {
    /// Follows or unfollows `username` (the row changes at once and goes back when the server refuses).
    /// Returns the line to show when it failed.
    func toggleFollow(_ username: String) async -> String? {
        guard !pending.contains(username), let index = people.firstIndex(where: { $0.username == username }) else { return nil }
        let wasFollowing = people[index].followed
        pending.insert(username)
        people[index].isFollowing = !wasFollowing
        defer { pending.remove(username) }
        do {
            let api = session.api
            let relation = try await session.authorized { try await api.follow(username, on: !wasFollowing, token: $0) }
            if let now = people.firstIndex(where: { $0.username == username }) {
                people[now].isFollowing = relation.isFollowing
                people[now].isFriend = relation.isFriend
            }
            return nil
        } catch {
            if let now = people.firstIndex(where: { $0.username == username }) { people[now].isFollowing = wasFollowing }
            return (error as? APIError)?.persianMessage ?? APIError.badResponse.persianMessage
        }
    }
}

/// «پیدا کردن دوست»: people by the start of their username. The search waits for a short pause in typing, and an
/// answer that arrives after the text changed is dropped.
@MainActor @Observable
final class PeopleSearchModel: FollowList {
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
    @ObservationIgnored private var task: Task<Void, Never>?

    init(session: Session, debounce: Duration = .milliseconds(300)) {
        self.session = session
        self.debounce = debounce
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
                phase = .failed((error as? APIError)?.persianMessage ?? APIError.badResponse.persianMessage)
            }
        }
    }

    /// Waits for the search in flight (for tests).
    func settle() async {
        await task?.value
    }
}

/// My friends, a page at a time.
@MainActor @Observable
final class FriendsListModel: FollowList {
    enum Phase: Equatable {
        case loading, loaded
        case failed(String)
    }

    var people: [FoundPerson] = []
    var pending: Set<String> = []
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

    func loadMore() async {
        guard let cursor = nextCursor, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        await fetch(cursor: cursor)
    }

    private func fetch(cursor: String?) async {
        do {
            let api = session.api
            let page = try await session.authorized { try await api.friends(cursor: cursor, token: $0) }
            people += page.items.filter { new in !people.contains { $0.username == new.username } }
            nextCursor = page.nextCursor
            phase = .loaded
        } catch {
            if cursor == nil { phase = .failed((error as? APIError)?.persianMessage ?? APIError.badResponse.persianMessage) }
        }
    }
}
