#if DEBUG
import Foundation

/// Debug launch arguments, for opening a screen straight away (simulator screenshots):
/// `-beytTab home|explore|games|messages|me`, `-beytUnread <n>`, `-beytRoute stickers`.
/// Values that don't parse are ignored.
struct LaunchOptions: Equatable {
    enum Route: String { case stickers }

    private(set) var tab: Tab?
    private(set) var unread: Int?
    private(set) var route: Route?

    init(_ values: [String: Any]) {
        tab = (values["beytTab"] as? String).flatMap(Tab.init(rawValue:))
        route = (values["beytRoute"] as? String).flatMap(Route.init(rawValue:))
        let count = (values["beytUnread"] as? Int) ?? (values["beytUnread"] as? String).flatMap { Int($0) }
        unread = count.flatMap { $0 >= 0 ? $0 : nil }
    }

    static var fromProcess: LaunchOptions {
        LaunchOptions(UserDefaults.standard.dictionaryRepresentation())
    }
}
#endif
