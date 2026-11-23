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
}
