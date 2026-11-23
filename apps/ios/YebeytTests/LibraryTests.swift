import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct LibraryTests {
    private let library = try! Library(bundle: Fixtures.appBundle)

    @Test func loadsTheCuratedPoetsBooksAndMoods() {
        #expect(library.poets.count == 48)
        #expect(library.books.count == 99)
        #expect(library.poetCount == 48)
        #expect(library.moods.map(\.title) == ["عشق", "دلتنگی", "امید", "بهار", "جوونی", "دوستی"])
    }

    @Test func theExplorePoetsComeInCurationOrder() {
        #expect(library.explorePoets.count == 12)
        #expect(library.explorePoets.prefix(3).map(\.slug) == ["hafez", "saadi", "moulavi"])
    }

    @Test func aPoetHasTheCuratedFieldsAndAPlace() throws {
        let hafez = try #require(library.poet(slug: "hafez"))
        #expect(hafez.name == "حافظ" && hafez.tag == "شاعرِ غزل" && hafez.color == .lapis)
        #expect(hafez.place == "شیراز · قرن هشتم")
        let bidel = try #require(library.poet(slug: "bidel"))
        #expect(bidel.place == "دهلی")  // no century known: the part is left out
    }

    @Test func aDivanHasItsSectionsWithUnitsAndTheDirectPoems() throws {
        let hafez = try #require(library.book(path: "/hafez"))
        #expect(hafez.title == "دیوان حافظ" && hafez.type == .divan && hafez.recited)
        #expect(hafez.rows.map(\.title) == ["غزلیات", "قطعات", "رباعیات", "قصاید", "اشعار منتسب"])
        #expect(hafez.rows.map(\.unit) == ["غزل", "قطعه", "رباعی", "قصیده", "شعر"])
        #expect(hafez.mainSection.title == "غزلیات" && hafez.mainSection.count == 495)
        #expect(hafez.unit == "غزل")
        #expect(hafez.poems?.map(\.title).contains("ساقی‌نامه") == true)
        #expect(hafez.meta == "قرن هشتم · ۶۹۵ شعر · با خوانش")
    }

    @Test func aBookWithoutChildCategoriesIsOneRowForItself() throws {
        let khayyam = try #require(library.book(path: "/khayyam/robaee"))
        #expect(khayyam.sections == nil)
        #expect(khayyam.rows.map(\.id) == [khayyam.id])
        #expect(khayyam.rows.first?.unit == "رباعی")
    }

    @Test func booksAreFoundByPathAndByAPoemPath() {
        #expect(library.book(containing: "/hafez/ghazal/sh3")?.path == "/hafez")
        #expect(library.book(containing: "/khayyam/robaee/sh1")?.path == "/khayyam/robaee")
        #expect(library.book(containing: "/nowhere/x/y") == nil)
        let found = library.section(path: "/hafez/ghazal")
        #expect(found?.book.path == "/hafez" && found?.section.id == 24)
        #expect(library.mainBook(of: "saadi")?.path == "/saadi/divan/ghazals")
    }

    @Test func theIndexListsEveryPoemWithItsPathNumberAndPopularity() async throws {
        let hafez = try #require(library.book(path: "/hafez"))
        let index = try await library.index(of: hafez)
        #expect(index.poems.count == hafez.count)
        let third = try #require(index.poem(path: "/hafez/ghazal/sh3"))
        #expect(third.number == 3 && third.catId == 24 && third.couplets == 9 && third.recitations > 0)
        #expect(!third.first.isEmpty && !third.rhyme.isEmpty)
        #expect(index.poems(in: 24).count == 495)
        #expect(index.poems(inAny: [25, 26]).count == 76)
        #expect(index.poem(path: "/hafez/masnavi")?.catId == hafez.id)
    }

    @Test func theIndexKnowsHowFarAlongAPoemIsAndWhereASectionStarts() async throws {
        let hafez = try #require(library.book(path: "/hafez"))
        let index = try await library.index(of: hafez)
        let first = try #require(index.first(in: hafez.rows[0]))
        #expect(first.path == "/hafez/ghazal/sh1")  // not the masnavi that sits directly in the book
        #expect(hafez.shortTitle(of: first) == "غزل ۱")
        let fraction = try #require(index.fraction(of: "/hafez/ghazal/sh3"))
        #expect(fraction > 0 && fraction < 0.1)
        #expect(index.fraction(of: "/nowhere/x/y") == nil)
        let last = try #require(index.poems.last)
        #expect(index.fraction(of: last.path) == 1)
    }

    @Test func aSubtreeIsEveryIdBelowASection() throws {
        let book = try #require(library.books.first { ($0.sections?.contains { !$0.children.isEmpty } ?? false) })
        let parent = try #require(book.sections?.first { !$0.children.isEmpty })
        #expect(parent.subtreeIds.contains(parent.id))
        #expect(parent.subtreeIds.isSuperset(of: parent.children.map(\.id)))
        #expect(book.section(id: parent.children[0].id)?.id == parent.children[0].id)
    }

    @Test func everyBookHasAnIndexFile() async throws {
        for book in library.books {
            let index = try await library.index(of: book)
            #expect(index.poems.count == book.count, "\(book.title)")
        }
    }
}
