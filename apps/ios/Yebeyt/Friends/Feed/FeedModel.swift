import Foundation
import Observation

/// The home «دوستات» feed, newest first, a page at a time.
@MainActor @Observable
final class FeedModel {
    struct Entry: Identifiable, Equatable {
        var id: String
        var item: FeedItem
    }

    private(set) var entries: [Entry] = []
    private(set) var hasLoaded = false
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
        hasLoaded = true
    }

    func loadMore() async {
        guard let cursor = nextCursor, let page = await fetch(cursor: cursor) else { return }
        let known = Set(entries.map(\.id))
        entries += page.items.map(Self.entry).filter { !known.contains($0.id) }
        nextCursor = page.nextCursor
    }

    private static func entry(_ item: FeedItem) -> Entry {
        Entry(id: "\(item.type.rawValue)|\(item.user.username)|\(item.key ?? item.date ?? "")|\(item.at)", item: item)
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
