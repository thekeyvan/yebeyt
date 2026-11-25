import Foundation
import Observation
import SwiftUI

/// The divan two friends share: its couplets (newest first), the counts, the filter chips and the likes.
@MainActor @Observable
final class SharedDivanModel {
    /// The chips: everything, what the other person added, what I added, or one poet's couplets.
    enum Filter: Hashable, Sendable {
        case all, them, me
        case poet(String)

        /// What the server is asked for; a poet is chosen among the couplets of everyone.
        var author: SharedDivanAuthor {
            switch self {
            case .all, .poet: .all
            case .them: .them
            case .me: .me
            }
        }
    }

    enum Phase: Equatable {
        case loading, loaded
        case failed(String)
    }

    let username: String
    private(set) var divan: SharedDivan?
    private(set) var items: [SharedDivanItem] = []
    private(set) var counts: SharedDivanCounts?
    private(set) var filter = Filter.all
    private(set) var phase = Phase.loading
    private(set) var isLoadingMore = false
    /// The poets of the couplets seen so far, the most frequent first; the poet chips.
    private(set) var poetSlugs: [String] = []
    var toast: String? {
        didSet { toastSerial += 1 }
    }
    /// Counts every assignment of `toast`, so the same line shown again starts its time over.
    private(set) var toastSerial = 0
    /// The screen is showing: a reconnect reads it again.
    var isVisible = false

    @ObservationIgnored private let session: Session
    @ObservationIgnored private var cursor: String?
    @ObservationIgnored private var loadedAuthor = SharedDivanAuthor.all
    /// The couplets taken out, by me or live: an event about one again (mine comes to me too) has nothing left to do.
    @ObservationIgnored private var taken: Set<String> = []

    init(username: String, session: Session) {
        self.username = username
        self.session = session
    }

    var other: ChatPerson? { divan?.other }
    var hasMore: Bool { cursor != nil }

    /// What the list shows: the loaded couplets, only one poet's when a poet chip is on.
    var visibleItems: [SharedDivanItem] {
        guard case .poet(let slug) = filter else { return items }
        return items.filter { Self.poetSlug(of: $0.key) == slug }
    }

    /// «۲۴ بیت · سارا ۱۳، تو ۱۱»
    func subtitle(name: String) -> String? {
        counts.map { "\(PersianDigits.string($0.total)) بیت · \(name) \(PersianDigits.string($0.theirs))، تو \(PersianDigits.string($0.mine))" }
    }

    static func poetSlug(of key: String) -> String? {
        CoupletKey.parse(key)?.path.split(separator: "/").first.map(String.init)
    }

    // MARK: Loading

    /// Finds the divan with this person (made when there is none, which only friends can) and reads its couplets.
    func load() async {
        if items.isEmpty { phase = .loading }
        do {
            if divan == nil { divan = try await findOrOpen() }
            guard let divan else { return }
            try await readItems(of: divan.id, reset: true)
            phase = .loaded
        } catch let error as APIError {
            if items.isEmpty { phase = .failed(MessageCopy.toast(for: error, sharedDivan: true)) }
        } catch {}
    }

    func loadMore() async {
        guard let divan, let cursor, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        try? await readItems(of: divan.id, from: cursor)  // the end of the list asks again
    }

    func select(_ new: Filter) async {
        guard new != filter else { return }
        let before = loadedAuthor
        filter = new
        if new.author != before { await load() }
    }

    private func findOrOpen() async throws -> SharedDivan {
        var next: String?
        repeat {
            let page = try await session.authorized { try await self.session.api.sharedDivans(cursor: next, token: $0) }
            if let found = page.items.first(where: { $0.other.username == username }) { return found }
            next = page.nextCursor
        } while next != nil
        return try await session.authorized { try await self.session.api.openSharedDivan(username: self.username, token: $0) }
    }

    private func readItems(of id: String, from start: String? = nil, reset: Bool = false) async throws {
        let author = filter.author
        let page = try await session.authorized { try await self.session.api.sharedDivanItems(id: id, by: author, cursor: start, token: $0) }
        if reset {
            items = page.items
            loadedAuthor = author
        } else {
            let known = Set(items.map(\.id))
            items += page.items.filter { !known.contains($0.id) }
        }
        cursor = page.nextCursor
        counts = page.counts
        if author == .all { notePoets() }
    }

    /// The poet chips: the poets of the couplets of everyone, the most frequent first (a tie keeps the newest first).
    private func notePoets() {
        var counts: [String: Int] = [:]
        var order: [String] = []
        for item in items {
            guard let slug = Self.poetSlug(of: item.key) else { continue }
            if counts[slug] == nil { order.append(slug) }
            counts[slug, default: 0] += 1
        }
        poetSlugs = order.enumerated().sorted { (counts[$0.element]!, $1.offset) > (counts[$1.element]!, $0.offset) }.map(\.element)
    }

    // MARK: Likes

    /// Takes my like on or off at once; the server's answer replaces the item, and a failure puts it back.
    func toggleLike(_ item: SharedDivanItem) async {
        guard let divan, let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        let liked = !items[index].likedByMe
        items[index].likedByMe = liked
        do {
            let answer = try await session.authorized { try await self.session.api.setSharedDivanLike(id: divan.id, item: item.id, liked: liked, token: $0) }
            if let now = items.firstIndex(where: { $0.id == item.id }) { items[now] = answer }
        } catch {
            if let now = items.firstIndex(where: { $0.id == item.id }) { items[now].likedByMe = !liked }
            toast = (error as? APIError).map { MessageCopy.toast(for: $0) }
        }
    }

    // MARK: Removing

    /// «بردار»: a couplet I added goes out of the list at once (with the list's spring); the server is asked, and a
    /// failure puts it back where it was with the toast. A couplet the other person added is never removed.
    func remove(_ item: SharedDivanItem) async {
        guard let divan, item.addedByMe, let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        let (before, countsBefore) = (items[index], counts)
        withAnimation(Motion.bouncy) {
            items.remove(at: index)
            if var counts {
                counts.total -= 1
                counts.mine -= 1
                self.counts = counts
            }
            if filter.author == .all { notePoets() }
        }
        taken.insert(item.id)
        do {
            try await session.authorized { try await self.session.api.removeSharedDivanItem(id: divan.id, item: item.id, token: $0) }
        } catch let error as APIError where Self.isNotFound(error) {
            return  // already gone from the server: it stays out of the list
        } catch {
            taken.remove(item.id)
            withAnimation(Motion.bouncy) {
                if !items.contains(where: { $0.id == before.id }) {
                    items.insert(before, at: min(index, items.count))
                }
                counts = countsBefore
                if filter.author == .all { notePoets() }
            }
            toast = (error as? APIError).map { MessageCopy.toast(for: $0) }
        }
    }

    private static func isNotFound(_ error: APIError) -> Bool {
        if case .server(let status, _, _) = error { status == 404 } else { false }
    }

    // MARK: Adding

    /// «+»: a couplet goes into this divan.
    func add(key: String, note: String?) async {
        guard let divan else { return }
        let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        let text = trimmed?.isEmpty == false ? trimmed?.limited(toUTF16: ChatModel.maxNoteLength) : nil
        do {
            _ = try await session.authorized { try await self.session.api.addSharedDivanItem(id: divan.id, key: key, note: text, token: $0) }
            // The answer doesn't say whether it was new (a couplet already there is a 200 and changes nothing), and the
            // live event of my own add may come too: the list and the counts are read again, never counted by hand.
            await load()
        } catch let error as APIError {
            toast = MessageCopy.toast(for: error, sharedDivan: true)
        } catch {}
    }

    // MARK: Live

    /// A couplet the other person added arrives at the top (when the chips would show it) and the counts move.
    func apply(_ event: LiveEvent) {
        if case .divanRemoved(let id, let itemId) = event {
            applyRemoval(of: itemId, in: id)
            return
        }
        guard case .divan(let id, let item) = event, id == divan?.id, !items.contains(where: { $0.id == item.id }) else { return }
        if var counts {
            counts.total += 1
            if item.addedByMe { counts.mine += 1 } else { counts.theirs += 1 }
            self.counts = counts
        }
        guard filter.author == .all || (filter.author == .me) == item.addedByMe else { return }
        items.insert(item, at: 0)
        if filter.author == .all { notePoets() }
    }

    /// A couplet leaves the list (with the list's spring) and the counts move; when the list doesn't hold it (a chip
    /// hides it, or it is further down) the list is read again, for the counts.
    private func applyRemoval(of itemId: String, in divanId: String) {
        guard divanId == divan?.id, taken.insert(itemId).inserted else { return }
        guard let index = items.firstIndex(where: { $0.id == itemId }) else {
            Task { await load() }
            return
        }
        withAnimation(Motion.bouncy) {
            let gone = items.remove(at: index)
            if var counts {
                counts.total -= 1
                if gone.addedByMe { counts.mine -= 1 } else { counts.theirs -= 1 }
                self.counts = counts
            }
            if filter.author == .all { notePoets() }
        }
    }
}
