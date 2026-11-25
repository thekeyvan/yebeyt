#if DEBUG
import Foundation

/// Debug launch arguments, for opening a screen straight away (simulator screenshots):
/// `-beytTab home|explore|games|messages|me`, `-beytUnread <n>`, `-beytRoute stickers|poem:<path>`, and the
/// library routes `-beytRoute library|book:<path>|section:<path>|poet:<slug>|search:<query>|mood:<key>|poets`
/// (they open the کاوش tab with those screens pushed). The game routes `-beytRoute games-catalog|daily|jigsaw|jigsaw-result|jigsaw-wrong|round-end|poet-game|second|book-game|match|listen`
/// open the بازی tab with the catalog, or a game in front; `-beytPlay <n>` plays a little first (daily: n tries; جورچین:
/// n couplets, then a sticker in hand; the quiz games: n answered, then an option chosen, and with `-beytSheet answer`
/// the last answer's sheet left open; معنی‌یاب: n pairs) and `-beytToday <yyyy-mm-dd>` fixes the Tehran day.
/// `-beytStub 1` makes گوش کن use canned recitations (no network, no sound).
/// With `poem:` the reader opens, and `-beytCouplet <n>` (0-based), `-beytMode scroll`, `-beytSheet text`,
/// `-beytMeaning 1` and `-beytHold <n>` set its state. The من routes `-beytRoute me|divan|privacy|avatar|invite|settings|badges`
/// open the من tab, with that screen pushed (`me` is the profile), `-beytRoute friends` pushes my friends there, and `-beytSeedDivan 1`
/// first keeps some sample couplets. `-beytRoute people|people:<text>|person:<username>` open the خونه tab with that screen pushed and `-beytRoute leaderboard`
/// the بازی tab with رده‌بندی (they want `-beytSignedIn 1`). `-beytFresh 1` first forgets what the phone has kept
/// (reading progress, marks, follows, rejected couplets, game stats). Values that don't parse are ignored.
struct LaunchOptions {
    enum Route: Equatable {
        case stickers
        case poem(String)
        case library
        case book(String)
        case section(String)
        case poet(String)
        case search(String)
        case mood(String)
        case poets
        case gamesCatalog
        case daily
        case jigsaw
        case jigsawResult
        case jigsawWrong
        case roundEnd
        case poetGame
        case second
        case bookGame
        case match
        case listen
        case me
        case divan
        case privacy
        case avatar
        case invite
        case settings
        case badges
        case people(String)
        case person(String)
        case leaderboard
        case friends

        init?(_ text: String) {
            let (name, value) = text.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
                .map(String.init).fixedPair
            switch (name, value) {
            case ("stickers", nil): self = .stickers
            case ("library", nil): self = .library
            case ("poets", nil): self = .poets
            case ("games-catalog", nil): self = .gamesCatalog
            case ("daily", nil): self = .daily
            case ("jigsaw", nil): self = .jigsaw
            case ("jigsaw-result", nil): self = .jigsawResult
            case ("jigsaw-wrong", nil): self = .jigsawWrong
            case ("round-end", nil): self = .roundEnd
            case ("poet-game", nil): self = .poetGame
            case ("second", nil): self = .second
            case ("book-game", nil): self = .bookGame
            case ("match", nil): self = .match
            case ("listen", nil): self = .listen
            case ("me", nil): self = .me
            case ("divan", nil): self = .divan
            case ("privacy", nil): self = .privacy
            case ("avatar", nil): self = .avatar
            case ("invite", nil): self = .invite
            case ("settings", nil): self = .settings
            case ("badges", nil): self = .badges
            case ("people", let text): self = .people(text ?? "")
            case ("leaderboard", nil): self = .leaderboard
            case ("friends", nil): self = .friends
            case ("person", let username?) where !username.isEmpty: self = .person(username)
            case ("poem", let path?) where Self.isPath(path): self = .poem(path)
            case ("book", let path?) where Self.isPath(path): self = .book(path)
            case ("section", let path?) where Self.isPath(path): self = .section(path)
            case ("poet", let slug?) where !slug.isEmpty: self = .poet(slug)
            case ("search", let query?) where !query.isEmpty: self = .search(query)
            case ("mood", let key?) where !key.isEmpty: self = .mood(key)
            default: return nil
            }
        }

        private static func isPath(_ text: String) -> Bool { text.hasPrefix("/") && text.count > 1 }

        /// The route opens something on the من tab.
        var isMe: Bool {
            switch self {
            case .me, .divan, .privacy, .avatar, .invite, .settings, .badges, .friends: true
            default: false
            }
        }

        /// The route opens something on the بازی tab.
        var isGames: Bool {
            switch self {
            case .gamesCatalog, .daily, .jigsaw, .jigsawResult, .jigsawWrong, .roundEnd, .poetGame, .second, .bookGame, .match, .listen, .leaderboard: true
            default: false
            }
        }
    }

    private(set) var tab: Tab?
    private(set) var unread: Int?
    private(set) var route: Route?
    private let couplet: Int?
    private let mode: ReaderMode?
    private let sheet: String?
    private let meaning: String?
    private let hold: Int?
    private let play: Int?
    /// `-beytBoard league|friends|global`: the tab of رده‌بندی that opens first.
    private(set) var board: LeaderboardModel.Tab
    /// `-beytStub 1`: گوش کن plays canned recitations instead of asking Ganjoor.
    private let stub: Bool
    /// `-beytToday <yyyy-mm-dd>`: the Tehran day the games use instead of the real one.
    private(set) var today: TehranDay?
    /// `-beytFresh 1`: forget what the phone has kept (progress, marks, follows, rejects) before launching.
    private(set) var fresh: Bool
    /// `-beytSeedDivan 1`: keep sample couplets first, for screenshots of the divan and the profile.
    private(set) var seedDivan: Bool

    init(_ values: [String: Any]) {
        func number(_ key: String) -> Int? {
            let count = (values[key] as? Int) ?? (values[key] as? String).flatMap { Int($0) }
            return count.flatMap { $0 >= 0 ? $0 : nil }
        }
        tab = (values["beytTab"] as? String).flatMap(Tab.init(rawValue:))
        route = (values["beytRoute"] as? String).flatMap(Route.init)
        unread = number("beytUnread")
        couplet = number("beytCouplet")
        mode = (values["beytMode"] as? String).flatMap(ReaderMode.init(rawValue:))
        sheet = values["beytSheet"] as? String
        meaning = (values["beytMeaning"] as? String) ?? (values["beytMeaning"] as? Int).map(String.init)
        hold = number("beytHold")
        play = number("beytPlay")
        board = switch values["beytBoard"] as? String {
        case "friends": .friends
        case "global": .global
        default: .league
        }
        stub = number("beytStub") == 1
        today = (values["beytToday"] as? String).flatMap { TehranDay(key: $0) }
        fresh = number("beytFresh") == 1
        seedDivan = number("beytSeedDivan") == 1
    }

    @MainActor static let savedStateKeys = [
        ReaderMarks.defaultsKey, ReaderMarks.divanKey, ReadingProgress.defaultsKey, Follows.defaultsKey, HomeModel.defaultsKey, GameStats.defaultsKey, GameStats.ownerKey, GameStats.claimedKey,
        PrivacyStore.defaultsKey, PrivacyStore.unsentKey, AvatarStore.defaultsKey, AvatarStore.unsentKey, Achievements.defaultsKey,
        FeedbackSettings.shakeKey,
    ]

    @MainActor static func resetSavedState(in defaults: UserDefaults = .standard) {
        savedStateKeys.forEach(defaults.removeObject(forKey:))
    }

    /// The screens a library route pushes on the کاوش tab, from the library's books (a route to something
    /// that doesn't exist pushes nothing). A book or section goes through the Library, as when tapped.
    @MainActor func destinations(in library: Library) -> [Destination] {
        switch route {
        case .library: return [.library]
        case .poets: return [.allPoets]
        case .poet(let slug): return library.poet(slug: slug) == nil ? [] : [.poet(slug)]
        case .search(let query): return [.search(query)]
        case .mood(let key): return library.moods.contains { $0.key == key } ? [.mood(key)] : []
        case .book(let path): return library.book(path: path).map { [.library, .book($0.id)] } ?? []
        case .section(let path): return library.section(path: path).map { [.library, .book($0.book.id), .section(book: $0.book.id, section: $0.section.id)] } ?? []
        case .stickers, .poem, .gamesCatalog, .daily, .jigsaw, .jigsawResult, .jigsawWrong, .roundEnd, .poetGame, .second, .bookGame, .match, .listen, nil: return []
        case .me, .divan, .privacy, .avatar, .invite, .settings, .badges, .friends, .people, .person, .leaderboard: return []
        }
    }

    /// The screen a من route pushes on the من tab.
    var mePath: [Destination] {
        switch route {
        case .divan: [.divan]
        case .privacy: [.privacy]
        case .avatar: [.avatar]
        case .invite: [.invite]
        case .settings: [.settings]
        case .badges: [.badges]
        case .friends: [.friends]
        default: []
        }
    }

    /// What the «پیدا کردن دوست» field starts with (`people:<text>`).
    var peopleText: String {
        if case .people(let text) = route { text } else { "" }
    }

    /// The screens a friends route pushes on the خونه tab.
    var homePath: [Destination] {
        switch route {
        case .people: [.people]
        case .person(let username): [.person(username)]
        default: []
        }
    }

    /// The screens a games route pushes on the بازی tab.
    var gamesPath: [Destination] {
        switch route {
        case .gamesCatalog: [.gamesCatalog]
        case .leaderboard: [.leaderboard]
        default: []
        }
    }

    /// The game a games route opens.
    var game: GameRoute? {
        switch route {
        case .daily: .daily
        case .jigsaw, .jigsawResult, .jigsawWrong, .roundEnd: .jigsaw(.deck)
        case .poetGame: .quiz(.poet)
        case .second: .quiz(.misra(poet: nil))
        case .bookGame: .quiz(.book)
        case .match: .match
        case .listen: .quiz(.listen)
        default: nil
        }
    }

    /// What the game plays by itself before it is shown.
    var autoplay: GameAutoplay {
        switch route {
        case .jigsawResult: .sheet(4)
        case .jigsawWrong: .wrong(checked: sheet == "answer")
        case .roundEnd: .end
        case .daily: play.map(GameAutoplay.tries) ?? .none
        case .jigsaw: play.map(GameAutoplay.held) ?? .none
        case .poetGame, .second, .bookGame, .listen: .quiz(answered: play ?? 0, sheet: sheet == "answer", stubbed: stub)
        case .match: .match(pairs: play ?? 0)
        default: .none
        }
    }

    /// The reader to open at launch, when the route is a poem.
    var reader: ReaderRoute? {
        guard case .poem(let path) = route else { return nil }
        return ReaderRoute(path: path, couplet: couplet ?? 0, mode: mode ?? .couplet, textSheet: sheet == "text", meaning: meaning == "1", hold: hold)
    }

    static var fromProcess: LaunchOptions {
        LaunchOptions(UserDefaults.standard.dictionaryRepresentation())
    }
}

private extension Array where Element == String {
    /// The name before the first colon, and the text after it (nil when there is no colon).
    var fixedPair: (String, String?) {
        (first ?? "", count > 1 ? self[1] : nil)
    }
}
#endif
