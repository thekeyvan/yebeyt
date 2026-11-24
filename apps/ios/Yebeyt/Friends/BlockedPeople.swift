import Observation

/// Whom I blocked since the app opened, by the account that did it. The lists that were loaded before (search,
/// friends, the home feed) drop them at once; what the server sends next time leaves them out by itself. Another
/// account, or nobody signed in, sees none of them.
@MainActor @Observable
final class BlockedPeople {
    private var byUser: [String: Set<String>] = [:]
    @ObservationIgnored private let session: Session

    init(session: Session) {
        self.session = session
    }

    /// Whom the signed-in account blocked.
    var usernames: Set<String> {
        session.user.flatMap { byUser[$0.id] } ?? []
    }

    func add(_ username: String) {
        guard let id = session.user?.id else { return }
        byUser[id, default: []].insert(username)
    }

    func visible(_ people: [FoundPerson]) -> [FoundPerson] {
        let hidden = usernames
        return people.filter { !hidden.contains($0.username) }
    }

    func visible(_ entries: [FeedModel.Entry]) -> [FeedModel.Entry] {
        let hidden = usernames
        return entries.filter { !hidden.contains($0.item.user.username) }
    }
}
