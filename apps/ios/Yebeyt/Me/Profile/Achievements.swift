import Foundation
import Observation

/// Counters the phone keeps for badges and avatar items, outside the games: right answers on Hafez couplets and
/// wins in «از کدوم کتاب؟» (a round with at least 7 right of 10). The games tell it through `GameStats`'s hooks.
@MainActor @Observable
final class Achievements {
    private struct Saved: Codable {
        var hafezRight = 0
        var bookWins = 0
    }

    static let defaultsKey = "me.achievements"

    private var saved: Saved
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        saved = defaults.data(forKey: Self.defaultsKey).flatMap { try? JSONDecoder().decode(Saved.self, from: $0) } ?? Saved()
    }

    var hafezRight: Int { saved.hafezRight }
    var bookWins: Int { saved.bookWins }

    /// A right answer in a quiz game, on a couplet of this poet.
    func recordRight(poetSlug: String) {
        guard poetSlug == "hafez" else { return }
        saved.hafezRight += 1
        save()
    }

    /// A finished quiz round: in «از کدوم کتاب؟» at least 7 right of 10 (the same share for any other length) is a win.
    func recordRound(game: GameKind, right: Int, of total: Int) {
        guard game == .book, total > 0, right * 10 >= total * 7 else { return }
        saved.bookWins += 1
        save()
    }

    private func save() {
        if let data = try? JSONEncoder().encode(saved) { defaults.set(data, forKey: Self.defaultsKey) }
    }
}

/// The «سطح» card: the level from the total points.
enum Level {
    static let steps: [(name: String, from: Int)] = [
        ("نوآموز", 0), ("بیت‌خوان", 500), ("غزل‌باز", 2000), ("سخن‌دان", 5000), ("استاد سخن", 12000),
    ]

    static func name(points: Int) -> String {
        steps.last { points >= $0.from }?.name ?? steps[0].name
    }
}

/// What the badges are measured on.
struct BadgeProgress: Equatable, Sendable {
    var bestStreak = 0
    var hafezRight = 0
    var coupletsRead = 0

    init(bestStreak: Int = 0, hafezRight: Int = 0, coupletsRead: Int = 0) {
        self.bestStreak = bestStreak
        self.hafezRight = hafezRight
        self.coupletsRead = coupletsRead
    }

    @MainActor
    init(stats: GameStats, achievements: Achievements, reading: ReadingProgress) {
        self.init(bestStreak: stats.bestStreak, hafezRight: achievements.hafezRight, coupletsRead: reading.readCouplets.count)
    }
}

extension AvatarProgress {
    @MainActor
    init(stats: GameStats, achievements: Achievements) {
        self.init(bookWins: achievements.bookWins, bestStreak: stats.bestStreak)
    }
}

/// A badge: its name, the rule that earns it, and how it looks. Locked badges are drawn grey.
struct MeBadge: Identifiable, Equatable, Sendable {
    enum Color: Sendable { case fire, amber, lapis, green }

    let id: String
    let title: String
    let rule: String
    let color: Color
    /// The tilt of the sticker, in degrees (the board's).
    let tilt: Double
    let earned: Bool

    static func all(_ progress: BadgeProgress) -> [MeBadge] {
        [
            MeBadge(id: "streak7", title: "۷ روز", rule: "۷ روز پشت‌سرهم معمای روز رو حل کن", color: .fire, tilt: -8, earned: progress.bestStreak >= 7),
            // The first مشاعره needs friends (slice 8): locked until then.
            MeBadge(id: "firstMosh", title: "اولین مشاعره", rule: "اولین مشاعره‌ت رو بازی کن", color: .amber, tilt: 6, earned: false),
            MeBadge(id: "hafez", title: "حافظ‌شناس", rule: "به ۵۰ بیت حافظ درست جواب بده", color: .lapis, tilt: -4, earned: progress.hafezRight >= 50),
            MeBadge(id: "read100", title: "۱۰۰ بیت", rule: "۱۰۰ بیت بخون", color: .green, tilt: 0, earned: progress.coupletsRead >= 100),
        ]
    }
}
