import Foundation
import Observation

/// What the phone keeps of the games until accounts exist: the points, the streak, the best of each game and
/// each day's daily puzzle. Stored as JSON in UserDefaults.
@MainActor @Observable
final class GameStats {
    private struct Saved: Codable {
        var points = 0
        var solvedDays: [Int] = []
        var best: [String: Int] = [:]
        var daily: [Int: DailyRecord] = [:]
    }

    static let defaultsKey = "games.stats"
    static let ownerKey = "games.stats.owner"

    private var saved: Saved
    /// The Tehran day the app shows; `refreshToday()` moves it at midnight.
    private(set) var today: TehranDay
    /// The account these points were carried over to; nil while they are a guest's, or from before accounts knew.
    private(set) var owner: String?
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let now: () -> Date

    init(defaults: UserDefaults = .standard, now: @escaping () -> Date = { .now }) {
        self.defaults = defaults
        self.now = now
        today = TehranDay(date: now())
        owner = defaults.string(forKey: Self.ownerKey)
        saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(Saved.self, from: $0) } ?? Saved()
    }

    var points: Int { saved.points }

    /// A person signs in: the points on the phone go to the first account that does, and stay that account's. Returns
    /// whether they are `userID`'s.
    func claim(for userID: String) -> Bool {
        if owner == nil {
            owner = userID
            defaults.set(userID, forKey: Self.ownerKey)
        }
        return owner == userID
    }

    /// The days in a row the daily puzzle was solved, up to today. A day not played yet doesn't break it
    /// until the day is over.
    var streak: Int {
        let solved = Set(saved.solvedDays)
        var day = solved.contains(today.number) ? today : today.previous
        var count = 0
        while solved.contains(day.number) {
            count += 1
            day = day.previous
        }
        return count
    }

    func best(_ game: GameKind) -> Int { saved.best[game.rawValue] ?? 0 }

    /// The longest run of days the daily puzzle was solved, ever (what the «۷ روز» badge and the candle ask for).
    var bestStreak: Int {
        var longest = 0
        var run = 0
        var previous: Int?
        for day in Set(saved.solvedDays).sorted() {
            run = previous == day - 1 ? run + 1 : 1
            longest = max(longest, run)
            previous = day
        }
        return longest
    }

    /// Told when a quiz answer is right, with the couplet's poet (for the «حافظ‌شناس» badge).
    @ObservationIgnored var rightAnswerHandler: (@MainActor (String) -> Void)?

    func recordRightAnswer(poetSlug: String) {
        rightAnswerHandler?(poetSlug)
    }

    /// Told when a quiz round ends, with how many answers were right of how many questions.
    @ObservationIgnored var roundHandler: (@MainActor (GameKind, Int, Int) -> Void)?

    func recordRoundEnd(of game: GameKind, right: Int, questions: Int) {
        roundHandler?(game, right, questions)
    }

    /// Told when a round of a solo game is over, with its points (for the server).
    @ObservationIgnored var finishedRoundHandler: (@MainActor (GameKind, Int) -> Void)?

    func finishRound(of game: GameKind, points: Int) {
        finishedRoundHandler?(game, points)
    }

    /// Told when a day's puzzle is over, solved or out of tries: the day, whether it was solved, the tries it took and its points.
    @ObservationIgnored var finishedDailyHandler: (@MainActor (TehranDay, Bool, Int, Int) -> Void)?

    func daily(on day: TehranDay) -> DailyRecord? { saved.daily[day.number] }

    /// The app came back: after Tehran midnight it is a new day.
    func refreshToday() {
        let current = TehranDay(date: now())
        if current != today { today = current }
    }

    /// How long until the next Tehran midnight, for a timer that turns the day while the app stays open.
    var secondsUntilNextDay: TimeInterval {
        max(0, TehranDay(number: today.number + 1).start.timeIntervalSince(now()))
    }

    /// Keeps a day's puzzle. The moment it is first solved, its points are added and the day counts for the streak.
    func record(_ record: DailyRecord, on day: TehranDay) {
        let before = saved.daily[day.number]?.outcome ?? .playing
        let wasSolved = before == .solved
        saved.daily[day.number] = record
        if record.outcome == .solved, !wasSolved {
            saved.points += record.points
            if !saved.solvedDays.contains(day.number) { saved.solvedDays.append(day.number) }
            raiseBest(.daily, to: record.points)
        }
        persist()
        if before == .playing, record.outcome != .playing {
            finishedDailyHandler?(day, record.outcome == .solved, record.tries.count, record.points)
        }
    }

    /// Points earned in a round, as they come.
    func award(_ points: Int) {
        guard points > 0 else { return }
        saved.points += points
        persist()
    }

    func raiseBest(_ game: GameKind, to score: Int) {
        if score > best(game) {
            saved.best[game.rawValue] = score
            persist()
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(saved) { defaults.set(data, forKey: Self.defaultsKey) }
    }
}
