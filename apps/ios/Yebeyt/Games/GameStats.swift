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

    private var saved: Saved
    /// The Tehran day the app shows; `refreshToday()` moves it at midnight.
    private(set) var today: TehranDay
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let now: () -> Date

    init(defaults: UserDefaults = .standard, now: @escaping () -> Date = { .now }) {
        self.defaults = defaults
        self.now = now
        today = TehranDay(date: now())
        saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(Saved.self, from: $0) } ?? Saved()
    }

    var points: Int { saved.points }

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

    func daily(on day: TehranDay) -> DailyRecord? { saved.daily[day.number] }

    /// The app came back: after Tehran midnight it is a new day.
    func refreshToday() {
        let current = TehranDay(date: now())
        if current != today { today = current }
    }

    /// Keeps a day's puzzle. The moment it is first solved, its points are added and the day counts for the streak.
    func record(_ record: DailyRecord, on day: TehranDay) {
        let wasSolved = saved.daily[day.number]?.outcome == .solved
        saved.daily[day.number] = record
        if record.outcome == .solved, !wasSolved {
            saved.points += record.points
            if !saved.solvedDays.contains(day.number) { saved.solvedDays.append(day.number) }
            raiseBest(.daily, to: record.points)
        }
        persist()
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
