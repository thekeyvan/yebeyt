import Observation

/// The five tabs, in bar order (the first sits at the right in right-to-left).
/// The raw value is the name used by the `-beytTab` debug launch argument.
enum Tab: String, CaseIterable, Sendable {
    case home, explore, games, messages, me

    var title: String {
        switch self {
        case .home: "خونه"
        case .explore: "کاوش"
        case .games: "بازی"
        case .messages: "پیام‌ها"
        case .me: "من"
        }
    }
}

@MainActor @Observable
final class AppModel {
    private(set) var selectedTab: Tab
    var unreadCount: Int
    /// The poem on screen in the full-screen reader, nil when it is closed.
    var reader: ReaderRoute?
    /// The screens pushed on the کاوش tab: the library, a book, a poet, search.
    var explorePath: [Destination]

    init(tab: Tab = .home, unreadCount: Int = 0, reader: ReaderRoute? = nil, explorePath: [Destination] = []) {
        selectedTab = tab
        self.unreadCount = unreadCount
        self.reader = reader
        self.explorePath = explorePath
    }

    /// Tapping the tab you are on goes back to its first screen.
    func select(_ tab: Tab) {
        if tab == selectedTab, tab == .explore { explorePath = [] }
        selectedTab = tab
    }

    func openReader(_ route: ReaderRoute) {
        reader = route
    }

    func closeReader() {
        reader = nil
    }

    /// The reader's poet button: leaves the reader and opens the poet's page in the کاوش tab.
    func openPoet(slug: String) {
        reader = nil
        selectedTab = .explore
        explorePath = [.poet(slug)]
    }

    /// «بازی با این بیت»: for now it only leaves the reader for the games tab (slice 3 starts a game with the couplet).
    func playWithCouplet() {
        reader = nil
        selectedTab = .games
    }

    /// The text in the «پیام‌ها» badge; nil (badge hidden) when nothing is unread.
    var unreadBadgeText: String? {
        unreadCount > 0 ? PersianDigits.string(unreadCount) : nil
    }

    var unreadAccessibilityLabel: String? {
        unreadBadgeText.map { "\($0) پیام نخونده" }
    }
}
