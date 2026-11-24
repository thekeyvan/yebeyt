import Foundation
import Observation

/// Keeps پسند and بازنشر on the phone and on the server the same, for a signed-in person. A change is sent at once; what
/// could not be sent (no network, a server error) stays on the phone as «unsent», one entry per couplet and kind with
/// the last state, and goes on the next sync. A sync (when someone signs in, when the app comes to the front, when
/// signing out) sends what is unsent and then pulls the server's list: the server's wins, except for couplets still
/// unsent. A guest's changes are not kept. Each change knows whose it is: one of another account is dropped. The
/// first pull for an account sends the likes on the phone that the server lacks only when they were made while
/// signed in as that same account; otherwise the server's list replaces them (they may be another person's).
@MainActor @Observable
final class ReactionsSync {
    struct Change: Codable, Equatable, Sendable {
        var key: String
        var kind: ReactionKind
        var on: Bool
        /// The account it was made for (nil: not known, the next sync takes it).
        var userId: String?
    }

    static let unsentKey = "reader.reactions.unsent"
    static let ownerKey = "reader.reactions.owner"
    static let pulledKey = "reader.reactions.pulled"

    private(set) var unsent: [Change]
    @ObservationIgnored private let marks: ReaderMarks
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var running: Task<Void, Never>?
    /// The account that last liked or reposted something on this phone while signed in.
    @ObservationIgnored private var owner: String?
    /// The account the server's list was last pulled for.
    @ObservationIgnored private var pulledFor: String?

    init(marks: ReaderMarks, session: Session, defaults: UserDefaults = .standard) {
        self.marks = marks
        self.session = session
        self.defaults = defaults
        unsent = defaults.data(forKey: Self.unsentKey).flatMap { try? JSONDecoder().decode([Change].self, from: $0) } ?? []
        owner = defaults.string(forKey: Self.ownerKey)
        pulledFor = defaults.string(forKey: Self.pulledKey)
        marks.reactionDidChange = { [weak self] key, kind, on in self?.record(key: key, kind: kind, on: on) }
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
            if session.user == nil { await session.restore() }
            guard let me = session.user?.id else { return }  // who is signed in is not known (no network): try later
            unsent.removeAll { $0.userId != nil && $0.userId != me }
            save()
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
        owner = nil
        pulledFor = nil
        [Self.unsentKey, Self.ownerKey, Self.pulledKey].forEach(defaults.removeObject(forKey:))
    }

    private func record(key: String, kind: ReactionKind, on: Bool) {
        guard session.isSignedIn else { return }
        let change = Change(key: key, kind: kind, on: on, userId: session.user?.id)
        if let id = change.userId {
            owner = id
            defaults.set(id, forKey: Self.ownerKey)
        }
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
        guard session.isSignedIn, let me = session.user?.id else { return false }
        let sendOwn = pulledFor != me && owner == me
        for kind in ReactionKind.allCases {
            let mark: ReaderMarks.Mark = kind == .like ? .liked : .reposted
            let server = Set(items.filter { $0.kind == kind }.map(\.key))
            if sendOwn {
                for key in marks.keys(mark).subtracting(server).subtracting(unsent.filter { $0.kind == kind }.map(\.key)).sorted() {
                    unsent.append(Change(key: key, kind: kind, on: true, userId: me))
                }
            }
            marks.apply(server: server, as: mark, keeping: Set(unsent.filter { $0.kind == kind }.map(\.key)))
        }
        pulledFor = me
        defaults.set(me, forKey: Self.pulledKey)
        save()
        if sendOwn, hasUnsent { await flush() }
        return true
    }

    private func save() {
        if let data = try? JSONEncoder().encode(unsent) { defaults.set(data, forKey: Self.unsentKey) }
    }
}
