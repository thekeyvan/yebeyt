import Foundation

/// What a game line of a chat draws, worked out from the message, the game it names (when the phone knows it) and who
/// I am. No screens.
enum ChatGameLine: Equatable {
    struct Button: Equatable {
        enum Action: Equatable {
            /// Takes the free seat of the game, then opens it.
            case join(gameID: String)
            /// Opens the game.
            case open(gameID: String)
        }

        var title: String
        var action: Action
    }

    /// The مشاعره card of the board: the game and its last couplet, whose turn it is, «جواب بده».
    case mosh(MoshState, gameID: String)
    /// An invitation or the line of a رودررو: a sentence and, when there is something to do, a button.
    case invite(text: String, button: Button?)
    /// A line without a button: a game that ended, a challenge's result.
    case line(String)

    /// `me` is my username and `myID` my user id (the `by` of a game that ended is the winner's id). Nil for a message
    /// that is not a game line this app draws.
    static func make(message: ChatMessage, other: ChatPerson, game: FriendGame?, me: String, myID: String?) -> ChatGameLine? {
        guard let payload = message.payload else { return nil }
        switch (message.kind, payload.event) {
        case (.game, "game_invite"):
            return invitation(message: message, payload: payload, other: other, game: game, me: me)
        case (.game, "challenge_result"):
            let score = payload.score ?? 0
            return .line(message.fromMe ? PlayCopy.challengeResultMine(to: other.name, score: score) : PlayCopy.challengeResult(from: other.name, score: score))
        case (.system, "game_ended"):
            let name = GameKind(rawValue: payload.kind ?? "")?.name ?? "بازی"
            let result = payload.by == nil ? PlayCopy.title(.draw, other: other.name) : PlayCopy.title(payload.by == myID ? .won : .lost, other: other.name)
            return .line("\(name) با \(other.name) تموم شد · \(result)")
        default:
            return nil
        }
    }

    private static func invitation(message: ChatMessage, payload: MessagePayload, other: ChatPerson, game: FriendGame?, me: String) -> ChatGameLine {
        let id = payload.gameId ?? game?.id ?? ""
        let name = GameKind(rawValue: payload.kind ?? "")?.name ?? "بازی"
        let waiting = game?.status != .active && game?.status != .done
        if let game, game.kind == .mosh, !waiting {
            return .mosh(MoshState(game: game, me: me), gameID: id)
        }
        if let game, game.kind == .duel, game.status == .active {
            return .invite(text: "\(name) با \(other.name) · الان در جریانه", button: Button(title: "بزن بریم", action: .open(gameID: id)))
        }
        if let game, game.status == .done {
            let result = MoshState(game: game, me: me).outcomeTitle ?? PlayCopy.title(.draw, other: other.name)
            return .invite(text: "\(name) با \(other.name) · \(result)", button: nil)
        }
        if message.fromMe {
            return .invite(text: PlayCopy.invited(game: name), button: Button(title: "ببین", action: .open(gameID: id)))
        }
        return .invite(text: PlayCopy.invite(from: other.name, game: name), button: Button(title: "بزن بریم", action: .join(gameID: id)))
    }
}
