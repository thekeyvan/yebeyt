import Foundation
import Observation

/// The home «دوستات» feed, newest first, a page at a time, with the counts of the couplets on each page.
@MainActor @Observable
final class FeedModel {
    struct Entry: Identifiable, Equatable {
        var id: String
        var item: FeedItem
    }

    private(set) var entries: [Entry] = []
    /// Everyone's likes and reposts of the couplets shown, by key.
    private(set) var counts: [String: ReactionCounts] = [:]
    @ObservationIgnored private let session: Session
    @ObservationIgnored private var nextCursor: String?
    @ObservationIgnored private var isLoading = false

    init(session: Session) {
        self.session = session
    }

    var hasMore: Bool { nextCursor != nil }

    /// The first page again (the screen opened, the app came back).
    func refresh() async {
        guard session.isSignedIn else {
            entries = []
            nextCursor = nil
            return
        }
        guard let page = await fetch(cursor: nil) else { return }
        entries = page.items.map(Self.entry)
        nextCursor = page.nextCursor
        await loadCounts(for: page.items)
    }

    func loadMore() async {
        guard let cursor = nextCursor, let page = await fetch(cursor: cursor) else { return }
        let known = Set(entries.map(\.id))
        entries += page.items.map(Self.entry).filter { !known.contains($0.id) }
        nextCursor = page.nextCursor
        await loadCounts(for: page.items)
    }

    /// The counts of the couplets of a page, in one call (the server takes 50 keys; a page has 30 items).
    private func loadCounts(for items: [FeedItem]) async {
        var keys: [String] = []
        for key in items.compactMap(\.key) where !keys.contains(key) { keys.append(key) }
        let api = session.api
        for start in stride(from: 0, to: keys.count, by: 50) {
            let batch = Array(keys[start..<min(start + 50, keys.count)])
            if let found = try? await session.authorized({ try await api.reactionCounts(keys: batch, token: $0) }) {
                counts.merge(found) { _, new in new }
            }
        }
    }

    private static func entry(_ item: FeedItem) -> Entry {
        Entry(id: "\(item.type.rawValue)|\(item.user.username)|\(item.key ?? item.date ?? "")|\(item.at)", item: item)
    }

    /// What a count shows when my own like or repost may have changed since the server counted: the server's count
    /// without mine, plus mine as it is now.
    static func shown(_ count: Int, serverMine: Bool, localMine: Bool) -> Int {
        max(0, count - (serverMine ? 1 : 0) + (localMine ? 1 : 0))
    }

    /// One page; nil when it failed (a failed refresh keeps what is shown) or one is already coming.
    private func fetch(cursor: String?) async -> Feed? {
        guard !isLoading else { return nil }
        isLoading = true
        defer { isLoading = false }
        let api = session.api
        return try? await session.authorized { try await api.feed(cursor: cursor, token: $0) }
    }
}
