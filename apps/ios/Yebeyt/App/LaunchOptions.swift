#if DEBUG
import Foundation

/// Debug launch arguments, for opening a screen straight away (simulator screenshots):
/// `-beytTab home|explore|games|messages|me`, `-beytUnread <n>`, `-beytRoute stickers|poem:<path>`.
/// With `poem:` the reader opens, and `-beytCouplet <n>` (0-based), `-beytMode scroll`, `-beytSheet text`,
/// `-beytMeaning 1` and `-beytHold <n>` set its state. Values that don't parse are ignored.
struct LaunchOptions {
    enum Route: Equatable {
        case stickers
        case poem(String)

        init?(_ text: String) {
            if text == "stickers" {
                self = .stickers
            } else if text.hasPrefix("poem:"), case let path = String(text.dropFirst(5)), path.hasPrefix("/"), path.count > 1 {
                self = .poem(path)
            } else {
                return nil
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
#endif
