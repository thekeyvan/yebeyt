import Foundation

extension ProgressPayload {
    /// What the phone kept as a guest, in the form of `PUT /v1/me/progress`. Read through the public API of
    /// `GameStats`: the points, the streak (its last day is today when today's puzzle is solved, else yesterday)
    /// and the best score of every game played.
    @MainActor init(stats: GameStats) {
        points = stats.guestPoints
        streakDays = stats.streak
        let solvedToday = stats.daily(on: stats.today)?.outcome == .solved
        streakLastDate = stats.streak > 0 ? (solvedToday ? stats.today : stats.today.previous).key : nil
        bestByGame = Dictionary(uniqueKeysWithValues: GameKind.allCases.compactMap { kind in
            stats.best(kind) > 0 ? (kind.rawValue, stats.best(kind)) : nil
        })
    }

    /// Nothing worth sending.
    var isEmpty: Bool { points == 0 && streakDays == 0 && bestByGame.isEmpty }
}
