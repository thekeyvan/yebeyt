import Foundation
import Observation

/// What is kept on this phone until accounts exist: the poets followed (دنبال کن) and the books bookmarked.
@MainActor @Observable
final class Follows {
    enum Item: Hashable, Sendable {
        case poet(String)
        case book(Int)

        var key: String {
            switch self {
            case .poet(let slug): "poet:\(slug)"
            case .book(let id): "book:\(id)"
            }
        }
    }

    static let defaultsKey = "library.follows"

    private var keys: Set<String>
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        keys = Set(defaults.stringArray(forKey: Self.defaultsKey) ?? [])
    }

    func contains(_ item: Item) -> Bool { keys.contains(item.key) }

    /// Turns it on or off; returns whether it is on now.
    @discardableResult
    func toggle(_ item: Item) -> Bool {
        let isOn = keys.insert(item.key).inserted
        if !isOn { keys.remove(item.key) }
        defaults.set(keys.sorted(), forKey: Self.defaultsKey)
        return isOn
    }
}
