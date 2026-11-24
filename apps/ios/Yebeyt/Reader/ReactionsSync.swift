import Foundation
import Observation

/// Keeps پسند and بازنشر on the phone and on the server the same, for a signed-in person. A change is sent at once; what
/// could not be sent (no network, a server error) stays on the phone as «unsent», one entry per couplet and kind with
/// the last state, and goes on the next sync. A sync (when someone signs in, when the app comes to the front, when
/// signing out) sends what is unsent and then pulls the server's list: the server's wins, except for couplets still
/// unsent. A guest's changes are not kept.
@MainActor @Observable
final class ReactionsSync {
    struct Change: Codable, Equatable, Sendable {
        var key: String
        var kind: ReactionKind
        var on: Bool
    }

    static let unsentKey = "reader.reactions.unsent"

    private(set) var unsent: [Change]
    @ObservationIgnored private let marks: ReaderMarks
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var running: Task<Void, Never>?

    init(marks: ReaderMarks, session: Session, defaults: UserDefaults = .standard) {
        self.marks = marks
        self.session = session
        self.defaults = defaults
        unsent = defaults.data(forKey: Self.unsentKey).flatMap { try? JSONDecoder().decode([Change].self, from: $0) } ?? []
        marks.reactionDidChange = { [weak self] key, kind, on in self?.record(Change(key: key, kind: kind, on: on)) }
    }

    var hasUnsent: Bool { !unsent.isEmpty }

    /// Sends what is unsent, then reads the server's reactions and merges them. Returns whether it all went through
    /// (true too when there is no account to sync).
    @discardableResult
    func syncNow() async -> Bool {
        guard session.isSignedIn else { return true }
        await flush()
        let pulled = await pull()
        return pulled && unsent.isEmpty
    }

    /// Sends what is unsent, oldest first; a failure stops there. A call while one is running waits for it.
    func flush() async {
        guard session.isSignedIn else { return }
        if let running { return await running.value }
        let task = Task { @MainActor [self] in
            defer { running = nil }
            while let change = unsent.first {
                do {
                    let api = session.api
                    try await session.authorized { try await api.setReaction(change.kind, key: change.key, on: change.on, token: $0) }
                } catch let error as APIError where error.isFinal {
                    // The server will never take it: drop it.
                } catch {
                    break
                }
                unsent.removeAll { $0 == change }
                save()
            }
        }
        running = task
        await task.value
    }

    /// Waits for a send that is running, so nothing lands after the reactions are cleared.
    func stop() async {
        await running?.value
    }

    /// Forgets what is unsent (the account is gone from this phone).
    func clear() {
        unsent = []
        defaults.removeObject(forKey: Self.unsentKey)
    }

    private func record(_ change: Change) {
        guard session.isSignedIn else { return }
        unsent.removeAll { $0.key == change.key && $0.kind == change.kind }
        unsent.append(change)
        save()
        Task { await flush() }
    }

    private func pull() async -> Bool {
        let api = session.api
        var items: [MyReactions.Item] = []
        var cursor: String?
        repeat {
            do {
                let page = try await session.authorized { try await api.myReactions(cursor: cursor, token: $0) }
                items += page.items
                cursor = page.nextCursor
            } catch {
                return false
            }
        } while cursor != nil
        guard session.isSignedIn else { return false }
        for kind in ReactionKind.allCases {
            let waiting = Set(unsent.filter { $0.kind == kind }.map(\.key))
            marks.apply(server: Set(items.filter { $0.kind == kind }.map(\.key)), as: kind == .like ? .liked : .reposted, keeping: waiting)
        }
        return true
    }

    private func save() {
        if let data = try? JSONEncoder().encode(unsent) { defaults.set(data, forKey: Self.unsentKey) }
    }
}
