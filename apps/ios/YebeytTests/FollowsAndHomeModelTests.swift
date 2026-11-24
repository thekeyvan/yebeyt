import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct FollowsTests {
    private let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!

    @Test func nothingIsFollowedAtFirst() {
        let follows = Follows(defaults: defaults)
        #expect(!follows.contains(.poet("hafez")) && !follows.contains(.book(9)))
    }

    @Test func toggleTurnsFollowingOnAndOffPerItem() {
        let follows = Follows(defaults: defaults)
        #expect(follows.toggle(.poet("hafez")) == true)
        #expect(follows.contains(.poet("hafez")) && !follows.contains(.poet("saadi")) && !follows.contains(.book(9)))
        #expect(follows.toggle(.poet("hafez")) == false)
        #expect(!follows.contains(.poet("hafez")))
    }

    @Test func followsSurviveARestart() {
        let follows = Follows(defaults: defaults)
        follows.toggle(.poet("hafez"))
        follows.toggle(.book(9))
        let reopened = Follows(defaults: defaults)
        #expect(reopened.contains(.poet("hafez")) && reopened.contains(.book(9)))
    }
}

@MainActor
struct HomeModelTests {
    private let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!

    private func stores() throws -> (PoetryStore, Library) {
        (try PoetryStore(bundle: Fixtures.appBundle), try Library(bundle: Fixtures.appBundle))
    }

    @Test func todaysCoupletComesFromABundledBookAndNamesItsPoet() async throws {
        let (poetry, library) = try stores()
        let home = HomeModel(day: 20_500, defaults: defaults)
        #expect(home.pick == nil)
        await home.load(poetry: poetry, library: library)
        let pick = try #require(home.pick)
        #expect(poetry.bundledPaths.contains { pick.path.hasPrefix($0 + "/") })
        #expect(!pick.couplet.m1.isEmpty && !pick.poet.isEmpty && !pick.title.isEmpty)
    }

    @Test func theSameDayShowsTheSameCouplet() async throws {
        let (poetry, library) = try stores()
        let first = HomeModel(day: 20_500, defaults: defaults)
        await first.load(poetry: poetry, library: library)
        let second = HomeModel(day: 20_500, defaults: defaults)
        await second.load(poetry: poetry, library: library)
        #expect(first.pick?.path == second.pick?.path && first.pick?.index == second.pick?.index)
    }

    @Test func rejectingShowsAnotherCoupletAndIsRememberedForTheDay() async throws {
        let (poetry, library) = try stores()
        let home = HomeModel(day: 20_500, defaults: defaults)
        await home.load(poetry: poetry, library: library)
        let before = try #require(home.pick)
        await home.reject(poetry: poetry, library: library)
        let after = try #require(home.pick)
        #expect(home.rejected == 1 && (before.path != after.path || before.index != after.index))

        let reopened = HomeModel(day: 20_500, defaults: defaults)
        #expect(reopened.rejected == 1)
        await reopened.load(poetry: poetry, library: library)
        #expect(reopened.pick?.path == after.path && reopened.pick?.index == after.index)
    }

    @Test func takingARejectBackShowsTheSameCoupletAgainAndIsRemembered() async throws {
        let (poetry, library) = try stores()
        let home = HomeModel(day: 20_500, defaults: defaults)
        await home.load(poetry: poetry, library: library)
        let first = try #require(home.pick)
        await home.reject(poetry: poetry, library: library)
        await home.undoReject(onDay: 20_500, poetry: poetry, library: library)
        #expect(home.rejected == 0 && home.pick?.path == first.path && home.pick?.index == first.index)
        #expect(HomeModel(day: 20_500, defaults: defaults).rejected == 0)

        await home.undoReject(onDay: 20_500, poetry: poetry, library: library)  // nothing to take back
        #expect(home.rejected == 0)
    }

    @Test func aRejectOfYesterdayCanNotBeTakenBackToday() async throws {
        let (poetry, library) = try stores()
        let home = HomeModel(day: 20_500, defaults: defaults)
        await home.load(poetry: poetry, library: library)
        await home.reject(poetry: poetry, library: library)
        await home.refresh(today: 20_501, poetry: poetry, library: library)
        await home.undoReject(onDay: 20_500, poetry: poetry, library: library)
        #expect(home.day == 20_501 && home.rejected == 0)
        #expect(HomeModel(day: 20_500, defaults: defaults).rejected == 1)
    }

    @Test func comingBackOnANewDayShowsThatDaysCoupletWithoutRejects() async throws {
        let (poetry, library) = try stores()
        let home = HomeModel(day: 20_500, defaults: defaults)
        await home.load(poetry: poetry, library: library)
        await home.reject(poetry: poetry, library: library)
        #expect(home.rejected == 1)

        await home.refresh(today: 20_500, poetry: poetry, library: library)  // the same day changes nothing
        #expect(home.rejected == 1 && home.day == 20_500)

        await home.refresh(today: 20_501, poetry: poetry, library: library)
        #expect(home.day == 20_501 && home.rejected == 0)
        let fresh = HomeModel(day: 20_501, defaults: defaults)
        await fresh.load(poetry: poetry, library: library)
        #expect(home.pick?.path == fresh.pick?.path && home.pick?.index == fresh.pick?.index)
    }

    @Test func aNewDayStartsWithoutRejects() {
        _ = HomeModel(day: 20_500, defaults: defaults)
        defaults.set([20_500, 3], forKey: HomeModel.defaultsKey)
        #expect(HomeModel(day: 20_500, defaults: defaults).rejected == 3)
        #expect(HomeModel(day: 20_501, defaults: defaults).rejected == 0)
    }
}
