import Foundation
import Testing
@testable import Yebeyt

struct HomeTests {
    private func poem(_ path: String, couplets: Int, recitations: Int) -> IndexedPoem {
        IndexedPoem(id: 1, catId: 1, path: path, first: "", couplets: couplets, rhyme: "", recitations: recitations, number: 1)
    }

    @Test func candidatesAreTheCoupletsOfTheMostRecitedPoems() {
        let poems = [poem("/a/1", couplets: 2, recitations: 3), poem("/a/2", couplets: 3, recitations: 9), poem("/a/3", couplets: 4, recitations: 0)]
        let candidates = DailyPick.candidates(from: poems)
        #expect(candidates == [
            .init(path: "/a/2", couplet: 0), .init(path: "/a/2", couplet: 1), .init(path: "/a/2", couplet: 2),
            .init(path: "/a/1", couplet: 0), .init(path: "/a/1", couplet: 1),
        ])  // the poem nobody recited is not popular
    }

    @Test func onlyTheTopPoemsCount() {
        let poems = (1...150).map { poem("/a/\($0)", couplets: 1, recitations: $0) }
        let candidates = DailyPick.candidates(from: poems)
        #expect(candidates.count == DailyPick.poemLimit)
        #expect(candidates.first?.path == "/a/150")
    }

    private let candidates = (0..<120).map { DailyPick.Candidate(path: "/a/\($0 / 10)", couplet: $0 % 10) }

    @Test func aDayAlwaysGivesTheSameCouplet() {
        #expect(DailyPick.pick(day: 739_000, rejected: 0, from: candidates) == DailyPick.pick(day: 739_000, rejected: 0, from: candidates))
        #expect(DailyPick.pick(day: 739_000, rejected: 0, from: candidates) != nil)
    }

    @Test func differentDaysUsuallyGiveDifferentCouplets() {
        let picks = Set((739_000..<739_030).compactMap { DailyPick.pick(day: $0, rejected: 0, from: candidates) })
        #expect(picks.count > 20)
    }

    @Test func eachRejectShowsTheNextCandidateAndNoneRepeatsBeforeAllAreShown() {
        let sequence = (0..<candidates.count).compactMap { DailyPick.pick(day: 739_000, rejected: $0, from: candidates) }
        #expect(Set(sequence).count == candidates.count)
        #expect(sequence[0] != sequence[1])
        // the sequence is the same every time it is asked for
        #expect(DailyPick.pick(day: 739_000, rejected: 5, from: candidates) == sequence[5])
    }

    @Test func nothingIsPickedWithoutCandidates() {
        #expect(DailyPick.pick(day: 1, rejected: 0, from: []) == nil)
    }

    @Test func oneCandidateIsAlwaysThePick() {
        let only = [DailyPick.Candidate(path: "/a/1", couplet: 0)]
        #expect(DailyPick.pick(day: 5, rejected: 3, from: only) == only[0])
    }

    @Test func theDayNumberChangesAtLocalMidnight() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        let before = calendar.date(from: DateComponents(year: 2026, month: 11, day: 22, hour: 23, minute: 59))!
        let after = calendar.date(from: DateComponents(year: 2026, month: 11, day: 23, hour: 0, minute: 1))!
        #expect(DailyPick.dayNumber(for: after, calendar: calendar) == DailyPick.dayNumber(for: before, calendar: calendar) + 1)
    }

    @Test func theDateLineIsThePersianWeekdayDayAndMonth() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        let monday = calendar.date(from: DateComponents(year: 2026, month: 11, day: 23, hour: 12))!
        #expect(PersianDate.line(for: monday, timeZone: calendar.timeZone) == "دوشنبه ۲ آذر")
    }
}
