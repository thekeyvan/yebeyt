import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct MeRulesTests {
    private func defaults() -> UserDefaults { UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")! }

    // MARK: Level

    @Test func theLevelComesFromTheTotalPoints() {
        #expect(Level.name(points: 0) == "نوآموز")
        #expect(Level.name(points: 499) == "نوآموز")
        #expect(Level.name(points: 500) == "بیت‌خوان")
        #expect(Level.name(points: 1999) == "بیت‌خوان")
        #expect(Level.name(points: 2000) == "غزل‌باز")
        #expect(Level.name(points: 2480) == "غزل‌باز")
        #expect(Level.name(points: 5000) == "سخن‌دان")
        #expect(Level.name(points: 12000) == "استاد سخن")
        #expect(Level.name(points: 999_999) == "استاد سخن")
    }

    // MARK: Badges

    @Test func fourBadgesInTheBoardsOrderAllLockedAtFirst() {
        let badges = MeBadge.all(BadgeProgress())
        #expect(badges.map(\.title) == ["۷ روز", "اولین مشاعره", "حافظ‌شناس", "۱۰۰ بیت"])
        #expect(badges.allSatisfy { !$0.earned })
        #expect(badges.map(\.rule) == [
            "۷ روز پشت‌سرهم معمای روز رو حل کن", "اولین مشاعره‌ت رو بازی کن", "به ۵۰ بیت حافظ درست جواب بده", "۱۰۰ بیت بخون",
        ])
    }

    @Test func badgesAreEarnedAtTheirThresholds() {
        func earned(_ progress: BadgeProgress) -> [String] { MeBadge.all(progress).filter(\.earned).map(\.id) }
        #expect(earned(BadgeProgress(bestStreak: 6, hafezRight: 49, coupletsRead: 99)).isEmpty)
        #expect(earned(BadgeProgress(bestStreak: 7)) == ["streak7"])
        #expect(earned(BadgeProgress(hafezRight: 50)) == ["hafez"])
        #expect(earned(BadgeProgress(coupletsRead: 100)) == ["read100"])
        // The first مشاعره waits for slice 8: it stays locked whatever else is done.
        #expect(!earned(BadgeProgress(bestStreak: 30, hafezRight: 500, coupletsRead: 5_000)).contains("firstMosh"))
    }

    // MARK: Counters

    @Test func hafezAnswersAndBookWinsAreCountedAndKept() {
        let defaults = defaults()
        let counters = Achievements(defaults: defaults)
        counters.recordRight(poetSlug: "hafez")
        counters.recordRight(poetSlug: "saadi")
        counters.recordRight(poetSlug: "hafez")
        counters.recordRound(game: .book, right: 7, of: 10)
        counters.recordRound(game: .book, right: 6, of: 10)  // not a win
        counters.recordRound(game: .poet, right: 10, of: 10)  // only از کدوم کتاب؟ counts
        counters.recordRound(game: .book, right: 10, of: 10)
        #expect(counters.hafezRight == 2)
        #expect(counters.bookWins == 2)
        let reopened = Achievements(defaults: defaults)
        #expect(reopened.hafezRight == 2 && reopened.bookWins == 2)
    }

    /// Plays a round of 10 in از کدوم کتاب؟ with `right` right answers (Hafez couplets) through the stats hooks.
    private func playBookRound(right: Int, counters: Achievements) {
        let stats = GameStats(defaults: defaults())
        stats.rightAnswerHandler = { counters.recordRight(poetSlug: $0) }
        stats.roundHandler = { counters.recordRound(game: $0, right: $1, of: $2) }
        let questions = (0..<10).map { QuizMakerFixtures.question($0, poet: "hafez") }
        let session = QuizSession(round: QuizRound(kind: .book, questions: questions)!, stats: stats)
        for (index, question) in questions.enumerated() {
            session.select(index < right ? question.correct : (question.correct + 1) % question.options.count)
            session.confirm()
            session.next()
        }
    }

    @Test func aBookRoundWithSevenRightOfTenIsAWinAndCountsTheHafezAnswers() {
        let counters = Achievements(defaults: defaults())
        playBookRound(right: 6, counters: counters)
        #expect(counters.bookWins == 0)
        #expect(counters.hafezRight == 6)
        playBookRound(right: 7, counters: counters)
        #expect(counters.bookWins == 1)
        #expect(counters.hafezRight == 13)
    }

    @Test func theBestStreakIsTheLongestRunEverNotTheCurrentOne() {
        let stats = GameStats(defaults: defaults(), now: { TehranDay(number: 200).noon })
        for number in [100, 101, 102, 103, 104, 105, 106, 150, 151] {
            stats.record(DailyRecord(tries: ["مصام"], hinted: [], outcome: .solved, points: 100), on: TehranDay(number: number))
        }
        #expect(stats.streak == 0)
        #expect(stats.bestStreak == 7)
    }

    @Test func coupletsReadAreCountedOnceEach() {
        let saved = defaults()
        let progress = ReadingProgress(defaults: saved)
        progress.opened(path: "/a/b/c", couplet: 0, count: 5, title: "غزل ۱")
        progress.opened(path: "/a/b/c", couplet: 1, count: 5, title: "غزل ۱")
        progress.opened(path: "/a/b/c", couplet: 1, count: 5, title: "غزل ۱")
        progress.reachedEnd(path: "/a/b/d", count: 3)
        #expect(progress.readCouplets.count == 5)
        #expect(ReadingProgress(defaults: saved).readCouplets.count == 5)
    }

    // MARK: Favourite poet

    @Test func theFavouritePoetHasTheMostKeptThenTheMostRead() {
        let kept = ["/hafez/g/sh1#0", "/hafez/g/sh1#1", "/saadi/g/sh1#0", "/saadi/g/sh2#0", "/moulavi/m/sh1#0"]
        // A tie in kept couplets goes to the poet read more.
        #expect(FavouritePoet.slug(kept: kept, read: ["/saadi/g/sh1", "/saadi/g/sh2", "/hafez/g/sh1"]) == "saadi")
        #expect(FavouritePoet.slug(kept: kept, read: ["/hafez/g/sh1", "/hafez/g/sh9", "/saadi/g/sh1"]) == "hafez")
        // No kept couplets: the most read.
        #expect(FavouritePoet.slug(kept: [], read: ["/moulavi/m/sh1", "/moulavi/m/sh2", "/hafez/g/sh1"]) == "moulavi")
        #expect(FavouritePoet.slug(kept: [], read: []) == nil)
    }
}

enum QuizMakerFixtures {
    static func question(_ number: Int, poet: String) -> QuizQuestion {
        let couplet = GameFixtures.couplet(number, poet: poet)
        return QuizQuestion(
            kind: .book, couplet: couplet,
            options: [QuizOption(id: "a", title: "گلستان"), QuizOption(id: "b", title: "بوستان"), QuizOption(id: "c", title: "غزلیات")],
            correct: 1
        )
    }
}
