import Foundation
import Observation

/// Reports finished rounds to the server for a signed-in person: each round with a round id made once, so a retry never
/// counts twice, and the daily puzzle's result for the day. What could not be sent (no network, a server error, a
/// limit) waits in a queue on the phone and goes on the next flush: right away, when the app comes to the front and
/// after a sign-in. A 409 is the round already counted; any other refusal means the server will never take it, so
/// both leave the queue. A guest's rounds are not kept (the onboarding round is, as the account step follows). Each
/// entry knows whose round it is: one of another account is dropped, never sent as the signed-in person's.
@MainActor @Observable
final class ScoreSync {
    enum Item: Codable, Equatable, Sendable {
        case score(ScoreRequest)
        case daily(DailyRequest)
    }

    /// A round waiting to go; `userId` is the account it was played for (nil: not known, the next sign-in takes it).
    struct Entry: Codable, Equatable, Sendable {
        var userId: String?
        var item: Item
    }

    static let defaultsKey = "scores.unsent"

    private(set) var queue: [Entry]
    /// Told after a flush sent something, so the points shown can be fetched again.
    @ObservationIgnored var didSend: (@MainActor () -> Void)?
    @ObservationIgnored private let session: Session
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private var running: Task<Void, Never>?

    init(session: Session, defaults: UserDefaults = .standard, now: @escaping () -> Date = { .now }) {
        self.session = session
        self.defaults = defaults
        self.now = now
        queue = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode([Entry].self, from: $0) } ?? []
    }

    var hasUnsent: Bool { !queue.isEmpty }

    /// A round of `game` is over with `points` (clipped to the game's cap).
    func report(_ game: ScoreGame, points: Int, keepWhileSignedOut: Bool = false) {
        guard session.isSignedIn || keepWhileSignedOut else { return }
        let clipped = game.clipped(points)
        guard clipped > 0 else { return }
        enqueue(.score(ScoreRequest(roundId: UUID().uuidString.lowercased(), game: game, points: clipped, playedAt: ServerTime.string(from: now()))))
    }

    /// The daily puzzle of `day` is over; its points go as a round of معمای امروز when it was solved.
    func reportDaily(on day: TehranDay, solved: Bool, tries: Int, points: Int) {
        guard session.isSignedIn else { return }
        enqueue(.daily(DailyRequest(date: day.key, solved: solved, tries: min(max(tries, 1), DailyGame.maxTries))))
        if solved { report(.daily, points: points) }
    }

    /// Forgets what is waiting (the account is gone from this phone).
    func clear() {
        queue = []
        defaults.removeObject(forKey: Self.defaultsKey)
    }

    /// Sends what is waiting, oldest first; a failure stops there and the rest waits. A call while one is running waits for it.
    func flush() async {
        guard session.isSignedIn else { return }
        if let running { return await running.value }
        let task = Task { @MainActor [self] in
            defer { running = nil }
            if session.user == nil { await session.restore() }
            guard let me = session.user?.id else { return }  // who is signed in is not known (no network): try later
            queue.removeAll { $0.userId != nil && $0.userId != me }
            save()
            var sent = false
            while let entry = queue.first {
                do {
                    try await send(entry.item)
                    sent = true
                } catch let error as APIError where error.isFinal {
                    // 409: already counted. Any other refusal is final too.
                } catch {
                    break
                }
                queue.removeAll { $0 == entry }
                save()
            }
            if sent { didSend?() }
        }
        running = task
        await task.value
    }

    /// Waits for a flush that is running, so nothing lands after the queue is cleared.
    func settle() async {
        await running?.value
    }

    private func enqueue(_ item: Item) {
        if !queue.contains(where: { $0.item == item }) { queue.append(Entry(userId: session.user?.id, item: item)) }
        save()
        Task { await flush() }
    }

    private func send(_ item: Item) async throws {
        let api = session.api
        switch item {
        case .score(let request): try await session.authorized { try await api.postScore(request, token: $0) }
        case .daily(let request): try await session.authorized { try await api.postDaily(request, token: $0) }
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(queue) { defaults.set(data, forKey: Self.defaultsKey) }
    }
}
