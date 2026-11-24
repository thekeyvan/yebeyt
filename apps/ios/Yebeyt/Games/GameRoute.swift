import Foundation

/// A quiz game open in front of the tabs.
enum QuizStart: Equatable, Sendable {
    case poet
    /// مصراع دوم, of the whole deck or (from a poet's page) of one poet only.
    case misra(poet: String?)
    case book
    case listen
    /// حدس شاعر with exactly these couplets, in this order (a challenge).
    case poetItems([GameCouplet])

    var kind: GameKind {
        switch self {
        case .poet, .poetItems: .poet
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
    /// «بازی با دوست».
    case lobby(LobbyStart)
    /// مشاعره and رودررو with a friend, by the game's id.
    case mosh(String)
    case duel(String)
    /// The board of a challenge opened by its code (`yebeyt.com/c/<code>`).
    case challenge(String)
    /// جورچین or حدس شاعر played first for a challenge that goes to these friends afterwards.
    case challengeRound(ChallengeGame, invite: [String])

    var id: String {
        switch self {
        case .daily: "daily"
        case .jigsaw(let start): "jigsaw \(start)"
        case .quiz(let start): "quiz \(start)"
        case .match: "match"
        case .lobby(let start): "lobby \(start)"
        case .mosh(let id): "mosh \(id)"
        case .duel(let id): "duel \(id)"
        case .challenge(let code): "challenge \(code)"
        case .challengeRound(let game, let invite): "challengeRound \(game) \(invite)"
        }
    }
}
