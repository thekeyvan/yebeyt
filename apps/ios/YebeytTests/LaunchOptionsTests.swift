import Testing
@testable import Yebeyt

struct LaunchOptionsTests {
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
}
