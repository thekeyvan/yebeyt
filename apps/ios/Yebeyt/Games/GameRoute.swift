import Foundation

/// A game open in front of the tabs.
enum GameRoute: Equatable, Identifiable, Sendable {
    case daily
    case jigsaw(JigsawStart)

    var id: String {
        switch self {
        case .daily: "daily"
        case .jigsaw(let start): "jigsaw \(start)"
        }
    }
}
