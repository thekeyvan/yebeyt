import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct ReadingProgressTests {
    private let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!

    @Test func nothingIsReadAtFirst() {
        let progress = ReadingProgress(defaults: defaults)
        #expect(progress.last == nil)
        #expect(!progress.isRead("/a/b/c") && !progress.isInProgress("/a/b/c"))
    }

    @Test func theLastOpenedPoemIsInProgress() {
        let progress = ReadingProgress(defaults: defaults)
        progress.opened(path: "/a/b/c", couplet: 2, count: 9, title: "غزل ۳")
        #expect(progress.last == ReadingProgress.Last(path: "/a/b/c", couplet: 2, title: "غزل ۳"))
        #expect(progress.isInProgress("/a/b/c") && !progress.isRead("/a/b/c"))
        progress.opened(path: "/a/b/d", couplet: 0, count: 5, title: "غزل ۴")
        #expect(!progress.isInProgress("/a/b/c") && progress.isInProgress("/a/b/d"))
    }

    @Test func reachingTheLastCoupletMakesAPoemRead() {
        let progress = ReadingProgress(defaults: defaults)
        progress.opened(path: "/a/b/c", couplet: 7, count: 9, title: "غزل ۳")
        #expect(!progress.isRead("/a/b/c"))
        progress.opened(path: "/a/b/c", couplet: 8, count: 9, title: "غزل ۳")
        #expect(progress.isRead("/a/b/c") && !progress.isInProgress("/a/b/c"))
        #expect(progress.last?.path == "/a/b/c")  // still the one to continue from
    }

    @Test func readingStaysEvenAfterGoingBack() {
        let progress = ReadingProgress(defaults: defaults)
        progress.opened(path: "/a/b/c", couplet: 8, count: 9, title: "غزل ۳")
        progress.opened(path: "/a/b/c", couplet: 1, count: 9, title: "غزل ۳")
        #expect(progress.isRead("/a/b/c"))
    }

    @Test func theEndOfTheWholePoemMakesItRead() {
        let progress = ReadingProgress(defaults: defaults)
        progress.opened(path: "/a/b/c", couplet: 0, count: 9, title: "غزل ۳")
        progress.reachedEnd(path: "/a/b/c")
        #expect(progress.isRead("/a/b/c"))
    }

    @Test func aOneCoupletPoemIsReadWhenOpened() {
        let progress = ReadingProgress(defaults: defaults)
        progress.opened(path: "/a/b/c", couplet: 0, count: 1, title: "رباعی ۱")
        #expect(progress.isRead("/a/b/c"))
    }

    @Test func readCountCountsOnlyTheGivenPoems() {
        let progress = ReadingProgress(defaults: defaults)
        progress.reachedEnd(path: "/a/b/1")
        progress.reachedEnd(path: "/a/b/2")
        progress.reachedEnd(path: "/x/y/1")
        #expect(progress.readCount(in: ["/a/b/1", "/a/b/2", "/a/b/3"]) == 2)
    }

    @Test func progressSurvivesARestart() {
        let progress = ReadingProgress(defaults: defaults)
        progress.opened(path: "/a/b/c", couplet: 1, count: 9, title: "غزل ۳")
        progress.reachedEnd(path: "/a/b/d")
        let reopened = ReadingProgress(defaults: defaults)
        #expect(reopened.last?.couplet == 1)
        #expect(reopened.isInProgress("/a/b/c") && reopened.isRead("/a/b/d"))
    }

    @Test func unreadableSavedDataStartsEmpty() {
        defaults.set(Data("not json".utf8), forKey: ReadingProgress.defaultsKey)
        #expect(ReadingProgress(defaults: defaults).last == nil)
    }
}
