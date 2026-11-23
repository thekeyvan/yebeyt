import Foundation
import Testing
@testable import Yebeyt

private func verse(_ order: Int, _ position: String, _ text: String, _ couplet: Int?, meaning: String? = nil) -> RawVerse {
    RawVerse(vOrder: order, position: position, text: text, coupletIndex: couplet, coupletSummary: meaning)
}

struct CoupletGroupingTests {
    @Test func ghazalPairsRightAndLeft() {
        let couplets = Couplet.grouping([
            verse(1, "Right", "الف", 0), verse(2, "Left", "ب", 0),
            verse(3, "Right", "پ", 1), verse(4, "Left", "ت", 1),
        ])
        #expect(couplets == [Couplet(m1: "الف", m2: "ب"), Couplet(m1: "پ", m2: "ت")])
    }

    @Test func keepsMeaningsWhereTheyExistAndStripsCarriageReturns() {
        let couplets = Couplet.grouping([
            verse(1, "Right", "الف\r", 0, meaning: "معنی\r\nدوم"), verse(2, "Left", "ب", 0),
            verse(3, "Right", "پ", 1), verse(4, "Left", "ت", 1),
        ])
        #expect(couplets[0].m1 == "الف")
        #expect(couplets[0].meaning == "معنی\nدوم")
        #expect(couplets[1].meaning == nil)
    }

    @Test func paragraphsAndSingleLinesGoInTheFirstSlot() {
        let couplets = Couplet.grouping([
            verse(1, "Paragraph", "نثر", 0), verse(2, "Single", "آزاد", 1),
            verse(3, "Right", "الف", 2), verse(4, "Left", "ب", 2),
        ])
        #expect(couplets == [Couplet(m1: "نثر", m2: ""), Couplet(m1: "آزاد", m2: ""), Couplet(m1: "الف", m2: "ب")])
    }

    @Test func aCommentWithoutAnIndexDecodesAndIsNotACouplet() throws {
        let json = """
        {"Id": 1, "Title": "رامشگر", "FullUrl": "/emad/no/sh1", "Verses": [
          {"VOrder": 1, "Position": "Comment", "Text": "(از چاتلان قوش)"},
          {"VOrder": 2, "Position": "Single", "Text": "الف", "CoupletIndex": 0},
          {"VOrder": 3, "Position": "Single", "Text": "ب", "CoupletIndex": 1}
        ]}
        """
        let poem = try JSONDecoder().decode(RawPoem.self, from: Data(json.utf8)).poem()
        #expect(poem.couplets == [Couplet(m1: "الف", m2: ""), Couplet(m1: "ب", m2: "")])
    }

    @Test func centeredVersesPairUp() {
        let couplets = Couplet.grouping([verse(1, "CenteredVerse1", "الف", 0), verse(2, "CenteredVerse2", "ب", 0)])
        #expect(couplets == [Couplet(m1: "الف", m2: "ب")])
    }

    @Test func twoFirstSlotVersesWithOneIndexStaySeparate() {
        let couplets = Couplet.grouping([verse(1, "Single", "الف", 0), verse(2, "Single", "ب", 0)])
        #expect(couplets == [Couplet(m1: "الف", m2: ""), Couplet(m1: "ب", m2: "")])
    }

    @Test func versesAreOrderedByVOrder() {
        let couplets = Couplet.grouping([verse(2, "Left", "ب", 0), verse(1, "Right", "الف", 0)])
        #expect(couplets == [Couplet(m1: "الف", m2: "ب")])
    }
}

struct RawDecodingTests {
    @Test func rawPoemDecodesLikeThePipelineWroteIt() throws {
        let raw = try JSONDecoder().decode(RawPoem.self, from: Fixtures.data("raw-poem-sh3"))
        let poem = raw.poem()
        let bundled = try #require(try BundledPoetry.book(id: 24, in: Fixtures.appBundle).poems.first { $0.path == "/hafez/ghazal/sh3" })
        #expect(poem == bundled)
        #expect(poem.couplets.count == 9)
        #expect(poem.summary?.hasPrefix("هوش مصنوعی") == true)
        #expect(poem.rhythm?.hasSuffix("(هزج مثمن سالم)") == true)
    }

    @Test func rawCategoryDecodesToABookWithItsChildren() throws {
        let raw = try JSONDecoder().decode(RawCategory.self, from: Fixtures.data("raw-category-ghete"))
        let book = raw.book()
        #expect(book.id == 25)
        #expect(book.poetId == 2)
        #expect(book.toc == "AlphabeticWithFirstCouplet")
        #expect(book.poems == [
            PoemRef(id: 2093, title: "قطعه شمارهٔ ۱", path: "/hafez/ghete/sh1"),
            PoemRef(id: 2094, title: "قطعه شمارهٔ ۲", path: "/hafez/ghete/sh2"),
        ])
        #expect(book.children == [BookRef(id: 9999, title: "زیربخش آزمایشی", path: "/hafez/ghete/zir")])
    }
}

struct RecitationTests {
    @Test func decodesOnlyWhatWeNeed() throws {
        let list = try JSONDecoder().decode([Recitation].self, from: Fixtures.data("recitations"))
        #expect(list.count == 3)
        let first = try #require(list.first { $0.id == 2842 })
        #expect(first.audioArtist == "فریدون فرح‌اندوز")
        #expect(first.mp3Url == URL(string: "https://i.ganjoor.net/a/2132-ff.mp3"))
        #expect(first.xmlUrl == URL(string: "https://i.ganjoor.net/a/x/2132-ff.xml"))
        #expect(first.inSyncWithText)
        #expect(first.audioOrder == 1)
    }

    @Test func anEmptyTimingUrlIsNoUrl() throws {
        let list = try JSONDecoder().decode([Recitation].self, from: Fixtures.data("recitations"))
        let plain = try #require(list.first { $0.id == 5000 })
        #expect(plain.xmlUrl == nil)
        #expect(!plain.inSyncWithText)
    }
}
