import Foundation

/// A quiz game open in front of the tabs.
enum QuizStart: Equatable, Sendable {
    case poet
    /// مصراع دوم, of the whole deck or (from a poet's page) of one poet only.
    case misra(poet: String?)
    case book
    case listen

    var kind: GameKind {
        switch self {
        case .poet: .poet
        case .misra: .misra
        case .book: .book
        case .listen: .listen
        }
    }
}

/// A game open in front of the tabs.
enum GameRoute: Equatable, Identifiable, Sendable {
    case daily
    case jigsaw(JigsawStart)
    case quiz(QuizStart)
    case match

    var id: String {
        switch self {
        case .daily: "daily"
        case .jigsaw(let start): "jigsaw \(start)"
        case .quiz(let start): "quiz \(start)"
        case .match: "match"
        }
    }
}
