import Testing
@testable import Yebeyt

@MainActor
struct AppModelTests {
    @Test func tabsAreInOrderWithPersianTitles() {
        #expect(Tab.allCases == [.home, .explore, .games, .messages, .me])
        #expect(Tab.allCases.map(\.title) == ["خونه", "کاوش", "بازی", "پیام‌ها", "من"])
    }

    @Test func startsOnHomeWithNothingUnread() {
        let model = AppModel()
        #expect(model.selectedTab == .home)
        #expect(model.unreadCount == 0)
    }

    @Test func selectingATabChangesTheSelection() {
        let model = AppModel()
        model.select(.games)
        #expect(model.selectedTab == .games)
        model.select(.me)
        #expect(model.selectedTab == .me)
    }

    @Test func theReaderOpensOnAPoemAndCloses() {
        let model = AppModel()
        #expect(model.reader == nil)
        model.openReader(ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 2))
        #expect(model.reader?.path == "/hafez/ghazal/sh3")
        model.closeReader()
        #expect(model.reader == nil)
    }

    @Test func playingWithACoupletClosesTheReaderAndStartsJigsawWithIt() {
        let model = AppModel(reader: ReaderRoute(path: "/hafez/ghazal/sh3"))
        model.playWithCouplet(poem: "/hafez/ghazal/sh3", index: 2)
        #expect(model.reader == nil)
        #expect(model.game == .jigsaw(.couplet(poem: "/hafez/ghazal/sh3", index: 2)))
    }

    @Test func playingWithAPoemStartsJigsawWithItsCouplets() {
        let model = AppModel(reader: ReaderRoute(path: "/hafez/ghazal/sh3"))
        model.playWithPoem("/hafez/ghazal/sh3")
        #expect(model.reader == nil)
        #expect(model.game == .jigsaw(.poem("/hafez/ghazal/sh3")))
    }

    @Test func aGameOpensOverTheTabsAndCloses() {
        let model = AppModel(tab: .games)
        model.play(.daily)
        #expect(model.game == .daily && model.selectedTab == .games)
        model.closeGame()
        #expect(model.game == nil)
    }

    @Test func tappingTheGamesTabAgainGoesBackFromTheCatalog() {
        let model = AppModel(tab: .games, gamesPath: [.gamesCatalog])
        model.select(.games)
        #expect(model.gamesPath.isEmpty)
    }

    @Test func thePoetButtonOfTheReaderClosesItAndOpensThePoetInTheExploreTab() {
        let model = AppModel(tab: .home, reader: ReaderRoute(path: "/hafez/ghazal/sh3"), explorePath: [.library, .book(9)])
        model.openPoet(slug: "hafez")
        #expect(model.reader == nil)
        #expect(model.selectedTab == .explore)
        #expect(model.explorePath == [.poet("hafez")])
    }

    @Test func tappingTheExploreTabAgainGoesBackToItsFirstScreen() {
        let model = AppModel(tab: .explore, explorePath: [.library, .book(9)])
        model.select(.explore)
        #expect(model.explorePath.isEmpty)
    }

    @Test func switchingTabsKeepsTheScreensPushedOnExplore() {
        let model = AppModel(tab: .explore, explorePath: [.library])
        model.select(.home)
        model.select(.explore)
        #expect(model.explorePath == [.library])
    }

    @Test func unreadBadgeIsHiddenAtZero() {
        let model = AppModel()
        #expect(model.unreadBadgeText == nil)
        #expect(model.unreadAccessibilityLabel == nil)
    }

    @Test func unreadBadgeUsesPersianDigits() {
        let model = AppModel(unreadCount: 12)
        #expect(model.unreadBadgeText == "۱۲")
        #expect(model.unreadAccessibilityLabel == "۱۲ پیام نخونده")
    }
}

@MainActor
struct CurrentScreenTests {
    @Test func theCurrentScreenIsTheTopOfTheSelectedTabOrWhatIsOverIt() {
        let model = AppModel(tab: .home)
        #expect(model.currentScreen == .home)
        model.select(.me)
        #expect(model.currentScreen == .me)
        model.mePath = [.settings]
        #expect(model.currentScreen == .settings)
        model.select(.explore)
        model.explorePath = [.library, .book(1)]
        #expect(model.currentScreen == .book)
        model.openReader(ReaderRoute(path: "/hafez/ghazal/sh3"))
        #expect(model.currentScreen == .reader)
        model.closeReader()
        model.play(.quiz(.misra(poet: nil)))
        #expect(model.currentScreen == .second)
        model.closeGame()
        #expect(model.currentScreen == .book)
    }
}
