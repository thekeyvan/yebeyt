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

    @Test func playingWithACoupletClosesTheReaderAndShowsTheGamesTab() {
        let model = AppModel(reader: ReaderRoute(path: "/hafez/ghazal/sh3"))
        model.playWithCouplet()
        #expect(model.reader == nil)
        #expect(model.selectedTab == .games)
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
