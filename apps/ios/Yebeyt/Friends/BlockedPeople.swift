import Observation

/// Whom I blocked since the app opened. The lists that were loaded before (search, friends, the home feed) drop them at
/// once; what the server sends next time leaves them out by itself.
@MainActor @Observable
final class BlockedPeople {
    private(set) var usernames: Set<String> = []

    func add(_ username: String) {
        usernames.insert(username)
    }

    func visible(_ people: [FoundPerson]) -> [FoundPerson] {
        people.filter { !usernames.contains($0.username) }
    }

    func visible(_ entries: [FeedModel.Entry]) -> [FeedModel.Entry] {
        entries.filter { !usernames.contains($0.item.user.username) }
    }
}
