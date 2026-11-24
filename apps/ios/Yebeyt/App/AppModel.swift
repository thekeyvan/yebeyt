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
    /// The badge of the «پیام‌ها» tab: the unread messages plus the incoming friend requests.
    var unreadCount: Int
    /// How many of `unreadCount` are friend requests.
    var friendRequestCount = 0
    /// The poem on screen in the full-screen reader, nil when it is closed.
    var reader: ReaderRoute?
    /// The screens pushed on the خونه tab: finding friends and a person's page.
    var homePath: [Destination]
    /// The screens pushed on the کاوش tab: the library, a book, a poet, search.
    var explorePath: [Destination]
    /// The screens pushed on the بازی tab: the catalog.
    var gamesPath: [Destination]
    /// The screens pushed on the من tab: the divan, privacy, the avatar, the invite, settings, badges.
    var mePath: [Destination]
    /// The screens pushed on the پیام‌ها tab: a chat, a shared divan.
    var messagesPath: [Destination]
    /// A line shown for a moment over the tabs («به دیوان من و سارا اضافه شد»); nil when none is.
    var toast: String?
    /// The couplet that «به دیوان مشترک» was chosen for, over the tabs; nil when no sheet is open.
    var sharedTarget: SharedDivanTarget?
    /// The couplet lifted by a long press outside the reader (the divan), shown over the tabs; nil when none is.
    var hold: HeldCouplet?
    /// What the iOS share sheet shows over the tabs, nil when it is closed.
    var share: ReaderModel.Share?
    /// The game open over the tabs, nil when none is.
    var game: GameRoute?
    /// The text «پیدا کردن دوست» starts with (a debug launch can fill the field).
    var peopleStart = ""
    /// The tab of رده‌بندی that opens first (a debug launch can start on another).
    var leaderboardStart = LeaderboardModel.Tab.league
    #if DEBUG
    /// What a debug launch plays by itself before the game is shown (`-beytPlay`).
    var autoplay = GameAutoplay.none
    #endif

    init(
        tab: Tab = .home, unreadCount: Int = 0, reader: ReaderRoute? = nil, homePath: [Destination] = [], explorePath: [Destination] = [],
        gamesPath: [Destination] = [], mePath: [Destination] = [], messagesPath: [Destination] = [], game: GameRoute? = nil
    ) {
        selectedTab = tab
        self.unreadCount = unreadCount
        self.reader = reader
        self.homePath = homePath
        self.explorePath = explorePath
        self.gamesPath = gamesPath
        self.mePath = mePath
        self.messagesPath = messagesPath
        self.game = game
    }

    /// Tapping the tab you are on goes back to its first screen.
    func select(_ tab: Tab) {
        if tab == selectedTab, tab == .home { homePath = [] }
        if tab == selectedTab, tab == .explore { explorePath = [] }
        if tab == selectedTab, tab == .games { gamesPath = [] }
        if tab == selectedTab, tab == .me { mePath = [] }
        if tab == selectedTab, tab == .messages { messagesPath = [] }
        selectedTab = tab
    }

    func openReader(_ route: ReaderRoute) {
        hold = nil
        reader = route
    }

    /// The screens drawn without the tab bar, as on their boards: the privacy, avatar and invite screens.
    var showsTabBar: Bool {
        if selectedTab == .messages { return messagesPath.isEmpty }  // a chat and a shared divan are drawn without it
        guard selectedTab == .me, let top = mePath.last else { return true }
        return ![.privacy, .avatar, .invite].contains(top)
    }

    func closeReader() {
        reader = nil
    }

    /// The screen in front, by name, for bug reports: the reader or a game over the tabs, else the top screen of the
    /// selected tab.
    var currentScreen: ScreenName {
        if reader != nil { return .reader }
        if let game { return ScreenName(game) }
        let top: Destination? = switch selectedTab {
        case .home: homePath.last
        case .explore: explorePath.last
        case .games: gamesPath.last
        case .me: mePath.last
        case .messages: messagesPath.last
        }
        return top.map(ScreenName.init) ?? ScreenName(selectedTab)
    }

    /// The reader's poet button: leaves the reader and opens the poet's page in the کاوش tab.
    func openPoet(slug: String) {
        reader = nil
        selectedTab = .explore
        explorePath = [.poet(slug)]
    }

    /// Switches to the پیام‌ها tab with the chat open (the entry of «پیام بده»; see `MessagesCenter.openChat`).
    func showChat(_ id: String) {
        reader = nil
        hold = nil
        selectedTab = .messages
        messagesPath = [.chat(id)]
    }

    func showToast(_ text: String) {
        toast = text
    }

    func play(_ route: GameRoute) {
        game = route
    }

    func closeGame() {
        game = nil
    }

    /// «بازی با این بیت»: leaves the reader and starts جورچین with that couplet.
    func playWithCouplet(poem: String, index: Int) {
        reader = nil
        game = .jigsaw(.couplet(poem: poem, index: index))
    }

    /// «بازی با این غزل»: leaves the reader and starts جورچین with the couplets of that poem.
    func playWithPoem(_ path: String) {
        reader = nil
        game = .jigsaw(.poem(path))
    }

    /// The text in the «پیام‌ها» badge; nil (badge hidden) when nothing is unread.
    var unreadBadgeText: String? {
        unreadCount > 0 ? PersianDigits.string(unreadCount) : nil
    }

    /// What VoiceOver says of the badge: the unread messages and the friend requests, each left out at zero.
    var unreadAccessibilityLabel: String? {
        let messages = max(unreadCount - friendRequestCount, 0)
        let parts = [
            messages > 0 ? "\(PersianDigits.string(messages)) پیام نخونده" : nil,
            friendRequestCount > 0 ? "\(PersianDigits.string(friendRequestCount)) درخواست دوستی" : nil,
        ]
        let label = parts.compactMap { $0 }.joined(separator: "، ")
        return label.isEmpty ? nil : label
    }
}
