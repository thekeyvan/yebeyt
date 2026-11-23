import Foundation
import Testing
@testable import Yebeyt

/// Couplets and decks for the game tests, built in code so the rules are tested on known words.
enum GameFixtures {
    static func couplet(
        _ number: Int, m1: String = "بنی آدم اعضای یکدیگرند", m2: String = "که در آفرینش ز یک گوهرند", poet: String = "saadi"
    ) -> GameCouplet {
        GameCouplet(
            poem: "/\(poet)/golestan/sh\(number)", index: 0, m1: m1, m2: m2, meaning: "آدم‌ها همه از یه ریشه‌ان.",
            poetSlug: poet, poetName: "سعدی", bookTitle: "گلستان"
        )
    }

    static func deck(_ count: Int) -> GameDeck {
        GameDeck(couplets: (0..<count).map { couplet($0, m2: "که در آفرینش ز یک گوهر\($0)") })
    }

    static func tehran(_ iso: String) -> Date {
        ISO8601DateFormatter().date(from: iso)!
    }

    @MainActor static func defaults() -> UserDefaults {
        let suite = "games-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }
}

struct TehranDayTests {
    @Test func theDayChangesAtTehranMidnightNotUTC() {
        // Tehran is UTC+3:30 all year: 20:29:59 UTC is 23:59:59 on the 22nd, one second later it is the 23rd.
        #expect(TehranDay(date: GameFixtures.tehran("2026-11-22T20:29:59Z")).key == "2026-11-22")
        #expect(TehranDay(date: GameFixtures.tehran("2026-11-22T20:30:00Z")).key == "2026-11-23")
        #expect(TehranDay(date: GameFixtures.tehran("2026-07-01T20:29:59Z")).key == "2026-07-01")  // no summer time
    }

    @Test func aKeyRoundTrips() throws {
        let day = try #require(TehranDay(key: "2026-11-23"))
        #expect(day.key == "2026-11-23")
        #expect(day.previous.key == "2026-11-22")
        #expect(day.number == day.previous.number + 1)
        #expect(TehranDay(key: "2026-12-01")!.previous.key == "2026-11-30")
    }

    @Test func badKeysAreRefused() {
        for key in ["", "2026-13-01", "2026-02-30", "yesterday", "2026-11", "2026-1-1-1"] {
            #expect(TehranDay(key: key) == nil, "\(key)")
        }
    }

    @Test func showsThePersianDate() throws {
        let day = try #require(TehranDay(key: "2026-11-23"))
        #expect(day.stickerParts.day == "۲")
        #expect(day.stickerParts.month == "آذر")
        #expect(day.line == "دوشنبه ۲ آذر")
    }
}

struct ScoringTests {
    @Test func tableFromTheDocs() {
        #expect(Scoring.dailyByTry == [100, 70, 40])
        #expect(Scoring.dailyHintCost == 30)
        #expect(Scoring.jigsawHintCost == 20)
        #expect(Scoring.jigsawWord == 20)
        #expect(Scoring.jigsawSecondLeft == 1)
    }

    @Test func dailyPointsByTryLessHints() {
        #expect(Scoring.daily(solvedOnTry: 1, hints: 0) == 100)
        #expect(Scoring.daily(solvedOnTry: 2, hints: 0) == 70)
        #expect(Scoring.daily(solvedOnTry: 3, hints: 0) == 40)
        #expect(Scoring.daily(solvedOnTry: 2, hints: 1) == 40)
        #expect(Scoring.daily(solvedOnTry: 3, hints: 2) == 0)
        #expect(Scoring.daily(solvedOnTry: 1, hints: 3) == 10)
        #expect(Scoring.daily(solvedOnTry: 4, hints: 0) == 0)
    }

    @Test func jigsawPointsPerWordLessHintsAndTimeBonus() {
        #expect(Scoring.jigsaw(correctWords: 3, hints: 0) == 60)
        #expect(Scoring.jigsaw(correctWords: 2, hints: 1) == 20)
        #expect(Scoring.jigsaw(correctWords: 0, hints: 2) == 0)
        #expect(Scoring.jigsawTimeBonus(secondsLeft: 42) == 42)
        #expect(Scoring.jigsawTimeBonus(secondsLeft: -3) == 0)
    }
}

@MainActor
struct GameStatsTests {
    private func solved() -> DailyRecord { DailyRecord(tries: ["مصام"], hinted: [], outcome: .solved, points: 100) }

    private func stats(on iso: String, defaults: UserDefaults = GameFixtures.defaults()) -> GameStats {
        GameStats(defaults: defaults, now: { GameFixtures.tehran(iso) })
    }

    @Test func startsEmpty() {
        let stats = stats(on: "2026-11-23T10:00:00Z")
        #expect(stats.points == 0 && stats.streak == 0 && stats.best(.jigsaw) == 0)
    }

    @Test func solvingTodayCountsOnceAndAddsThePoints() {
        let stats = stats(on: "2026-11-23T10:00:00Z")
        stats.record(solved(), on: stats.today)
        stats.record(solved(), on: stats.today)
        #expect(stats.points == 100)
        #expect(stats.streak == 1)
        #expect(stats.best(.daily) == 100)
    }

    @Test func aFailedOrUnfinishedPuzzleEarnsNothingAndKeepsNoStreak() {
        let stats = stats(on: "2026-11-23T10:00:00Z")
        stats.record(DailyRecord(tries: ["ا"], outcome: .playing), on: stats.today)
        stats.record(DailyRecord(tries: ["ا", "ب", "پ"], outcome: .failed), on: stats.today)
        #expect(stats.points == 0 && stats.streak == 0)
        #expect(stats.daily(on: stats.today)?.outcome == .failed)
    }

    @Test func theStreakCountsDaysInARowAndStopsAtAMissedDay() {
        let stats = stats(on: "2026-11-20T10:00:00Z")
        for back in [0, 1, 3, 4] {  // the 20th, 19th, 17th and 16th: the 18th was missed
            stats.record(solved(), on: TehranDay(number: stats.today.number - back))
        }
        #expect(stats.streak == 2)
    }

    @Test func todayNotPlayedYetKeepsYesterdaysStreakUntilTheDayIsOver() {
        let defaults = GameFixtures.defaults()
        var clock = GameFixtures.tehran("2026-11-22T10:00:00Z")
        let stats = GameStats(defaults: defaults, now: { clock })
        stats.record(solved(), on: stats.today)
        #expect(stats.streak == 1)
        clock = GameFixtures.tehran("2026-11-23T10:00:00Z")  // the next day, not played yet
        stats.refreshToday()
        #expect(stats.streak == 1)
        clock = GameFixtures.tehran("2026-11-24T10:00:00Z")  // a whole day missed
        stats.refreshToday()
        #expect(stats.streak == 0)
    }

    @Test func theTimerToTheNextDayCountsToTehranMidnight() {
        let stats = GameStats(defaults: GameFixtures.defaults(), now: { GameFixtures.tehran("2026-11-22T20:29:00Z") })
        #expect(stats.secondsUntilNextDay == 60)
        let noon = GameStats(defaults: GameFixtures.defaults(), now: { GameFixtures.tehran("2026-11-23T08:30:00Z") })  // noon in Tehran
        #expect(noon.secondsUntilNextDay == 12 * 3600)
    }

    @Test func theDayTurnsAtTehranMidnight() {
        var clock = GameFixtures.tehran("2026-11-22T20:29:00Z")
        let stats = GameStats(defaults: GameFixtures.defaults(), now: { clock })
        #expect(stats.today.key == "2026-11-22")
        clock = GameFixtures.tehran("2026-11-22T20:31:00Z")
        stats.refreshToday()
        #expect(stats.today.key == "2026-11-23")
    }

    @Test func pointsAndBestOnlyGoUp() {
        let stats = stats(on: "2026-11-23T10:00:00Z")
        stats.award(60)
        stats.award(0)
        stats.award(-5)
        stats.raiseBest(.jigsaw, to: 300)
        stats.raiseBest(.jigsaw, to: 120)
        #expect(stats.points == 60)
        #expect(stats.best(.jigsaw) == 300)
    }

    @Test func whatIsKeptSurvivesARestart() {
        let defaults = GameFixtures.defaults()
        let first = stats(on: "2026-11-23T10:00:00Z", defaults: defaults)
        first.record(solved(), on: first.today)
        first.award(40)
        let second = stats(on: "2026-11-23T10:00:00Z", defaults: defaults)
        #expect(second.points == 140 && second.streak == 1)
        #expect(second.daily(on: second.today) == solved())
    }
}
