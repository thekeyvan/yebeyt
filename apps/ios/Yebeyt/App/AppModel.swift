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

    init(tab: Tab = .home, unreadCount: Int = 0) {
        selectedTab = tab
        self.unreadCount = unreadCount
    }

    func select(_ tab: Tab) {
        selectedTab = tab
    }

    /// The text in the «پیام‌ها» badge; nil (badge hidden) when nothing is unread.
    var unreadBadgeText: String? {
        unreadCount > 0 ? PersianDigits.string(unreadCount) : nil
    }

    var unreadAccessibilityLabel: String? {
        unreadBadgeText.map { "\($0) پیام نخونده" }
    }
}
