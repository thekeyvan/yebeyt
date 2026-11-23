import Foundation
import Testing
@testable import Yebeyt

struct JigsawStartTests {
    private let poem = Poem(
        id: 1, title: "غزل ۳", path: "/hafez/ghazal/sh3", summary: nil, rhythm: nil,
        couplets: (0..<4).map { Couplet(m1: "بنی آدم اعضای یکدیگرند", m2: "که در آفرینش ز یک گوهرند \($0)", meaning: $0 == 2 ? "معنی" : nil, ai: $0 == 2 ? true : nil) }
    )

    private func opening(_ start: JigsawStart) -> [GameCouplet] {
        start.opening(from: poem, poetSlug: "hafez", poetName: "حافظ", bookTitle: "دیوان حافظ")
    }

    @Test func aCoupletOpensWithOnlyThatCouplet() {
        let couplets = opening(.couplet(poem: poem.path, index: 2))
        #expect(couplets.map(\.index) == [2])
        #expect(couplets[0].id == "/hafez/ghazal/sh3#2" && couplets[0].meaning == "معنی" && couplets[0].meaningIsAI)
        #expect(couplets[0].source == "حافظ · دیوان حافظ")
    }

    @Test func aPoemOpensWithAllItsCoupletsInOrder() {
        #expect(opening(.poem(poem.path)).map(\.index) == [0, 1, 2, 3])
    }

    @Test func theDeckOpensWithNothingAndABadIndexWithNothing() {
        #expect(opening(.deck).isEmpty)
        #expect(opening(.couplet(poem: poem.path, index: 9)).isEmpty)
    }
}

struct LaunchOptionsTests {
    @Test func readsGameRoutes() {
        for (text, route) in [("games-catalog", LaunchOptions.Route.gamesCatalog), ("daily", .daily), ("jigsaw", .jigsaw),
                              ("jigsaw-result", .jigsawResult), ("round-end", .roundEnd)] {
            #expect(LaunchOptions(["beytRoute": text]).route == route)
        }
    }

    @Test func gameRoutesOpenTheGameOrTheCatalogOnTheGamesTab() {
        #expect(LaunchOptions(["beytRoute": "daily"]).game == .daily)
        #expect(LaunchOptions(["beytRoute": "jigsaw"]).game == .jigsaw(.deck))
        #expect(LaunchOptions(["beytRoute": "jigsaw-result"]).game == .jigsaw(.deck))
        #expect(LaunchOptions(["beytRoute": "round-end"]).game == .jigsaw(.deck))
        #expect(LaunchOptions(["beytRoute": "games-catalog"]).game == nil)
        #expect(LaunchOptions(["beytRoute": "games-catalog"]).gamesPath == [.gamesCatalog])
        #expect(LaunchOptions(["beytRoute": "daily"]).gamesPath.isEmpty)
        #expect(LaunchOptions(["beytRoute": "poem:/hafez/ghazal/sh3"]).game == nil)
    }

    @Test func theResultAndEndRoutesPlayByThemselves() {
        #expect(LaunchOptions(["beytRoute": "jigsaw-result"]).autoplay == .sheet(4))
        #expect(LaunchOptions(["beytRoute": "round-end"]).autoplay == .end)
        #expect(LaunchOptions(["beytRoute": "jigsaw", "beytPlay": "3"]).autoplay == .held(3))
        #expect(LaunchOptions(["beytRoute": "daily", "beytPlay": "1"]).autoplay == .tries(1))
        #expect(LaunchOptions(["beytRoute": "daily"]).autoplay == .none)
        #expect(LaunchOptions(["beytRoute": "daily", "beytPlay": "many"]).autoplay == .none)
    }

    @Test func theOtherSoloGamesHaveRoutesToo() {
        for (text, route, game) in [
            ("poet-game", LaunchOptions.Route.poetGame, GameRoute.quiz(.poet)), ("second", .second, .quiz(.misra(poet: nil))),
            ("book-game", .bookGame, .quiz(.book)), ("match", .match, .match), ("listen", .listen, .quiz(.listen)),
        ] {
            let options = LaunchOptions(["beytRoute": text])
            #expect(options.route == route && options.game == game && options.route?.isGames == true)
        }
        #expect(LaunchOptions(["beytRoute": "poet-game", "beytPlay": "4"]).autoplay == .quiz(answered: 4, sheet: false, stubbed: false))
        #expect(LaunchOptions(["beytRoute": "second", "beytPlay": "2", "beytSheet": "answer"]).autoplay == .quiz(answered: 2, sheet: true, stubbed: false))
        #expect(LaunchOptions(["beytRoute": "listen", "beytStub": "1"]).autoplay == .quiz(answered: 0, sheet: false, stubbed: true))
        #expect(LaunchOptions(["beytRoute": "listen", "beytStub": "1"]).autoplay.stubsRecitations)
        #expect(LaunchOptions(["beytRoute": "match", "beytPlay": "3"]).autoplay == .match(pairs: 3))
        #expect(LaunchOptions(["beytRoute": "match"]).autoplay == .match(pairs: 0))
    }

    @Test func todayCanBeFixed() {
        #expect(LaunchOptions(["beytToday": "2026-11-23"]).today?.key == "2026-11-23")
        #expect(LaunchOptions(["beytToday": "soon"]).today == nil)
        #expect(LaunchOptions([:]).today == nil)
    }

    @MainActor @Test func freshForgetsTheGameStatsToo() {
        #expect(LaunchOptions.savedStateKeys.contains(GameStats.defaultsKey))
    }

    @Test func readsValidValues() {
        let options = LaunchOptions(["beytTab": "games", "beytUnread": "3", "beytRoute": "stickers"])
        #expect(options.tab == .games)
        #expect(options.unread == 3)
        #expect(options.route == .stickers)
    }

    @Test func readsEveryTabName() {
        for tab in Tab.allCases {
            #expect(LaunchOptions(["beytTab": tab.rawValue]).tab == tab)
        }
    }

    @Test func acceptsANumberForUnread() {
        #expect(LaunchOptions(["beytUnread": 5]).unread == 5)
    }

    @Test func ignoresInvalidValues() {
        let options = LaunchOptions(["beytTab": "settings", "beytUnread": "many", "beytRoute": "nowhere"])
        #expect(options.tab == nil)
        #expect(options.unread == nil)
        #expect(options.route == nil)
        #expect(LaunchOptions(["beytUnread": "-4"]).unread == nil)
        #expect(LaunchOptions(["beytTab": 3]).tab == nil)
    }

    @Test func emptyOptionsChangeNothing() {
        let options = LaunchOptions([:])
        #expect(options.tab == nil && options.unread == nil && options.route == nil)
    }

    @Test func readsAPoemRouteWithItsReaderOptions() {
        let options = LaunchOptions([
            "beytRoute": "poem:/hafez/ghazal/sh3", "beytCouplet": "1", "beytMode": "scroll",
            "beytSheet": "text", "beytMeaning": "1", "beytHold": "2",
        ])
        #expect(options.route == .poem("/hafez/ghazal/sh3"))
        let reader = options.reader
        #expect(reader == ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 1, mode: .scroll, textSheet: true, meaning: true, hold: 2))
    }

    @Test func aPoemRouteAloneOpensTheFirstCoupletOneByOne() {
        let reader = LaunchOptions(["beytRoute": "poem:/hafez/ghazal/sh3"]).reader
        #expect(reader == ReaderRoute(path: "/hafez/ghazal/sh3"))
        #expect(reader?.mode == .couplet && reader?.couplet == 0 && reader?.hold == nil)
    }

    @Test func readerOptionsWithoutAPoemOpenNothing() {
        #expect(LaunchOptions(["beytCouplet": "1", "beytMode": "scroll"]).reader == nil)
        #expect(LaunchOptions(["beytRoute": "stickers"]).reader == nil)
    }

    @Test func badPoemRoutesAndReaderValuesAreIgnored() {
        #expect(LaunchOptions(["beytRoute": "poem:"]).route == nil)
        #expect(LaunchOptions(["beytRoute": "poem:hafez"]).route == nil)
        let reader = LaunchOptions(["beytRoute": "poem:/a/b/c", "beytCouplet": "-1", "beytMode": "list", "beytSheet": "x", "beytMeaning": "0", "beytHold": "many"]).reader
        #expect(reader == ReaderRoute(path: "/a/b/c"))
    }

    @Test func readsTheLibraryRoutes() {
        func route(_ text: String) -> LaunchOptions.Route? { LaunchOptions(["beytRoute": text]).route }
        #expect(route("library") == .library)
        #expect(route("poets") == .poets)
        #expect(route("book:/hafez") == .book("/hafez"))
        #expect(route("section:/hafez/ghazal") == .section("/hafez/ghazal"))
        #expect(route("poet:hafez") == .poet("hafez"))
        #expect(route("search:عشق") == .search("عشق"))
        #expect(route("search:a:b") == .search("a:b"))
        #expect(route("mood:love") == .mood("love"))
    }

    @MainActor @Test func theFreshOptionForgetsWhatThePhoneKept() {
        #expect(LaunchOptions(["beytFresh": "1"]).fresh)
        #expect(!LaunchOptions(["beytFresh": "0"]).fresh && !LaunchOptions([:]).fresh)
        let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
        for key in LaunchOptions.savedStateKeys + ["other"] { defaults.set("x", forKey: key) }
        LaunchOptions.resetSavedState(in: defaults)
        #expect(LaunchOptions.savedStateKeys.allSatisfy { defaults.object(forKey: $0) == nil })
        #expect(defaults.string(forKey: "other") == "x")
    }

    @Test func badLibraryRoutesAreIgnored() {
        for text in ["book:", "book:hafez", "section:", "poet:", "search:", "mood:", "library:x", "poets:1", "shelf"] {
            #expect(LaunchOptions(["beytRoute": text]).route == nil, "\(text)")
        }
    }

    @MainActor @Test func libraryRoutesPushTheirScreensOnExplore() throws {
        let library = try Library(bundle: Fixtures.appBundle)
        func screens(_ text: String) -> [Destination] { LaunchOptions(["beytRoute": text]).destinations(in: library) }
        let hafez = try #require(library.book(path: "/hafez"))
        #expect(screens("library") == [.library])
        #expect(screens("poets") == [.allPoets])
        #expect(screens("poet:hafez") == [.poet("hafez")])
        #expect(screens("book:/hafez") == [.library, .book(hafez.id)])
        #expect(screens("section:/hafez/ghazal") == [.library, .book(hafez.id), .section(book: hafez.id, section: 24)])
        #expect(screens("search:عشق") == [.search("عشق")])
        #expect(screens("mood:love") == [.mood("love")])
        #expect(screens("poet:nobody").isEmpty && screens("book:/nobody").isEmpty && screens("mood:nope").isEmpty)
        #expect(LaunchOptions(["beytRoute": "stickers"]).destinations(in: library).isEmpty)
        #expect(LaunchOptions([:]).destinations(in: library).isEmpty)
    }
}
