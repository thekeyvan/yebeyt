import Foundation
import Observation

/// The moods of the taste step (OnbTaste), in board order. The key is what is stored.
enum TasteMood: String, CaseIterable, Sendable {
    case love, hope, longing, mystic, humor, epic, nature

    var title: String {
        switch self {
        case .love: "عاشقانه"
        case .hope: "امید"
        case .longing: "دلتنگی"
        case .mystic: "عرفانی"
        case .humor: "طنز"
        case .epic: "حماسی"
        case .nature: "طبیعت"
        }
    }
}

/// The poets and moods the person picked in onboarding. Kept on the phone only; «بیتِ امروز» prefers these poets.
@MainActor @Observable
final class Taste {
    static let poetsKey = "taste.poets"
    static let moodsKey = "taste.moods"

    private(set) var poets: Set<String>
    private(set) var moods: Set<TasteMood>
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        poets = Self.savedPoets(in: defaults)
        moods = Set((defaults.stringArray(forKey: Self.moodsKey) ?? []).compactMap(TasteMood.init(rawValue:)))
    }

    /// The poet slugs picked, for code that has no `Taste` at hand.
    static func savedPoets(in defaults: UserDefaults) -> Set<String> {
        Set(defaults.stringArray(forKey: poetsKey) ?? [])
    }

    func toggle(poet slug: String) {
        if !poets.insert(slug).inserted { poets.remove(slug) }
        defaults.set(poets.sorted(), forKey: Self.poetsKey)
    }

    func toggle(mood: TasteMood) {
        if !moods.insert(mood).inserted { moods.remove(mood) }
        defaults.set(moods.map(\.rawValue).sorted(), forKey: Self.moodsKey)
    }
}
