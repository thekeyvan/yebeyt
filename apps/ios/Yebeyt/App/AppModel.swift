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

    init(tab: Tab = .home, unreadCount: Int = 0, reader: ReaderRoute? = nil) {
        selectedTab = tab
        self.unreadCount = unreadCount
        self.reader = reader
    }

    func select(_ tab: Tab) {
        selectedTab = tab
    }

    func openReader(_ route: ReaderRoute) {
        reader = route
    }

    func closeReader() {
        reader = nil
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
