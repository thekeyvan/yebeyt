import Foundation

/// `{username, score}` in the events of a game.
struct GameScore: Equatable, Sendable, Decodable {
    var username: String
    var score: Int
}

/// A question of رودررو: the first hemistich (the second too, except for مصراع دوم), the poet's name when the
/// options don't tell it, and four or three options. `deadlineMs` is the time left in the round at the moment it was sent.
struct DuelQuestion: Equatable, Sendable {
    var gameId: String
    var round: Int
    var rounds: Int
    var kind: DuelKind
    var m1: String
    var m2: String?
    var poet: String?
    var options: [String]
    var deadlineMs: Int
}

extension LiveEvent {
    /// The events of games and challenges (`game.*`, `duel.*`, `challenge.result`); nil when it is another event or
    /// the fields are not as the contract says.
    static func decodeGame(type: String, data: Data) -> LiveEvent? {
        func read<Frame: Decodable>(_ frame: Frame.Type) -> Frame? { try? JSONDecoder().decode(frame, from: data) }
        switch type {
        case "game.started":
            struct Frame: Decodable { var game: FriendGame }
            return read(Frame.self).map { .gameStarted($0.game) }
        case "game.move":
            struct Frame: Decodable { var gameId: String; var move: MoshMove; var scores: [GameScore] }
            return read(Frame.self).map { .gameMove(gameId: $0.gameId, move: $0.move, scores: $0.scores) }
        case "game.turn":
            struct Frame: Decodable {
                var gameId: String
                var username: String
                var deadline: APIDate
            }
            return read(Frame.self).map { .gameTurn(gameId: $0.gameId, username: $0.username, deadline: $0.deadline.date) }
        case "game.ended":
            struct Frame: Decodable {
                var gameId: String
                var winner: String?
                var reason: FriendGame.EndReason
                var scores: [GameScore]
                var couplets: [DuelResult]?
            }
            return read(Frame.self).map { .gameEnded(gameId: $0.gameId, winner: $0.winner, reason: $0.reason, scores: $0.scores, couplets: $0.couplets ?? []) }
        case "duel.question":
            struct Frame: Decodable {
                struct Couplet: Decodable { var m1: String; var m2: String? }
                var gameId: String
                var round: Int
                var rounds: Int
                var kind: DuelKind
                var couplet: Couplet
                var poet: String?
                var options: [String]
                var deadlineMs: Int
            }
            return read(Frame.self).map {
                .duelQuestion(DuelQuestion(
                    gameId: $0.gameId, round: $0.round, rounds: $0.rounds, kind: $0.kind, m1: $0.couplet.m1, m2: $0.couplet.m2,
                    poet: $0.poet, options: $0.options, deadlineMs: $0.deadlineMs
                ))
            }
        case "duel.answered":
            struct Frame: Decodable { var gameId: String; var round: Int; var username: String }
            return read(Frame.self).map { .duelAnswered(gameId: $0.gameId, round: $0.round, username: $0.username) }
        case "duel.round":
            struct Frame: Decodable { var gameId: String; var round: Int; var winner: String?; var rightOption: Int; var scores: [GameScore] }
            return read(Frame.self).map { .duelRound(gameId: $0.gameId, round: $0.round, winner: $0.winner, rightOption: $0.rightOption, scores: $0.scores) }
        case "challenge.result":
            struct Frame: Decodable { var code: String; var game: ChallengeGame; var result: ChallengeLiveResult }
            return read(Frame.self).map { .challengeResult(code: $0.code, game: $0.game, result: $0.result) }
        default:
            return nil
        }
    }

    /// The frame a player's answer is sent as: `{"type":"duel.answer","gameId":…,"round":…,"option":…}`.
    static func duelAnswerFrame(gameId: String, round: Int, option: Int) -> String {
        struct Frame: Encodable { var type = "duel.answer"; var gameId: String; var round: Int; var option: Int }
        let data = (try? JSONEncoder().encode(Frame(gameId: gameId, round: round, option: option))) ?? Data()
        return String(decoding: data, as: UTF8.self)
    }
}
