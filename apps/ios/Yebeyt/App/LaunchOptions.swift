#if DEBUG
import Foundation

/// Debug launch arguments, for opening a screen straight away (simulator screenshots):
/// `-beytTab home|explore|games|messages|me`, `-beytUnread <n>`, `-beytRoute stickers|poem:<path>`, and the
/// library routes `-beytRoute library|book:<path>|section:<path>|poet:<slug>|search:<query>|mood:<key>|poets`
/// (they open the کاوش tab with those screens pushed).
/// With `poem:` the reader opens, and `-beytCouplet <n>` (0-based), `-beytMode scroll`, `-beytSheet text`,
/// `-beytMeaning 1` and `-beytHold <n>` set its state. `-beytFresh 1` first forgets what the phone has kept
/// (reading progress, marks, follows, rejected couplets). Values that don't parse are ignored.
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

        init?(_ text: String) {
            let (name, value) = text.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
                .map(String.init).fixedPair
            switch (name, value) {
            case ("stickers", nil): self = .stickers
            case ("library", nil): self = .library
            case ("poets", nil): self = .poets
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
    }

    private(set) var tab: Tab?
    private(set) var unread: Int?
    private(set) var route: Route?
    private let couplet: Int?
    private let mode: ReaderMode?
    private let sheet: String?
    private let meaning: String?
    private let hold: Int?
    /// `-beytFresh 1`: forget what the phone has kept (progress, marks, follows, rejects) before launching.
    private(set) var fresh: Bool

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
        fresh = number("beytFresh") == 1
    }

    @MainActor static let savedStateKeys = [ReaderMarks.defaultsKey, ReadingProgress.defaultsKey, Follows.defaultsKey, HomeModel.defaultsKey]

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
        case .stickers, .poem, nil: return []
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
