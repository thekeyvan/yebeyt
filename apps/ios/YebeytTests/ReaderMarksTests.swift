import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct ReaderMarksTests {
    private let defaults: UserDefaults

    init() {
        defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
    }

    @Test func keysAreThePoemPathAndTheCoupletIndex() {
        #expect(ReaderMarks.key(poemPath: "/hafez/ghazal/sh3", couplet: 1) == "/hafez/ghazal/sh3#1")
    }

    @Test func nothingIsMarkedAtFirst() {
        let marks = ReaderMarks(defaults: defaults)
        for mark in ReaderMarks.Mark.allCases {
            #expect(!marks.contains(mark, poemPath: "/a/b/c", couplet: 0))
        }
    }

    @Test func toggleTurnsAMarkOnAndOff() {
        let marks = ReaderMarks(defaults: defaults)
        #expect(marks.toggle(.liked, poemPath: "/a/b/c", couplet: 2) == true)
        #expect(marks.contains(.liked, poemPath: "/a/b/c", couplet: 2))
        #expect(marks.toggle(.liked, poemPath: "/a/b/c", couplet: 2) == false)
        #expect(!marks.contains(.liked, poemPath: "/a/b/c", couplet: 2))
    }

    @Test func marksAreIndependentPerKindCoupletAndPoem() {
        let marks = ReaderMarks(defaults: defaults)
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 2)
        #expect(!marks.contains(.liked, poemPath: "/a/b/c", couplet: 2))
        #expect(!marks.contains(.kept, poemPath: "/a/b/c", couplet: 3))
        #expect(!marks.contains(.kept, poemPath: "/a/b/d", couplet: 2))
    }

    @Test func marksSurviveARestart() {
        let marks = ReaderMarks(defaults: defaults)
        marks.toggle(.liked, poemPath: "/a/b/c", couplet: 0)
        marks.toggle(.reposted, poemPath: "/a/b/c", couplet: 1)
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 4)
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 4)

        let reopened = ReaderMarks(defaults: defaults)
        #expect(reopened.contains(.liked, poemPath: "/a/b/c", couplet: 0))
        #expect(reopened.contains(.reposted, poemPath: "/a/b/c", couplet: 1))
        #expect(reopened.contains(.kept, poemPath: "/a/b/c", couplet: 1))
        #expect(!reopened.contains(.kept, poemPath: "/a/b/c", couplet: 4))
        #expect(reopened.keys(.kept) == ["/a/b/c#1"])
    }

    @Test func unreadableSavedDataStartsEmpty() {
        defaults.set(Data("not json".utf8), forKey: ReaderMarks.defaultsKey)
        let marks = ReaderMarks(defaults: defaults)
        #expect(!marks.contains(.liked, poemPath: "/a/b/c", couplet: 0))
    }
}
