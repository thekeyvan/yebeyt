import Foundation
import Testing
@testable import Yebeyt

/// JSON of the games contract, and games built for tests.
enum GameJSON {
    static func player(_ username: String, name: String? = nil, seat: Int, score: Int = 0) -> String {
        let display = name.map { "\"\($0)\"" } ?? "null"
        return #"{"username":"\#(username)","displayName":\#(display),"avatar":null,"seat":\#(seat),"score":\#(score)}"#
    }

    static func move(n: Int, by username: String, key: String, m1: String, m2: String) -> String {
        #"{"n":\#(n),"username":"\#(username)","key":"\#(key)","m1":"\#(m1)","m2":"\#(m2)","createdAt":"2026-11-24T09:4\#(n):00.000Z"}"#
    }

    /// A game as the server writes it.
    static func game(
        id: String = "g1", kind: String = "mosh", turnSeconds: Int = 86_400, status: String = "active", winner: String? = nil, reason: String? = nil,
        players: [String]? = nil, turn: String? = #"{"username":"niloofar","deadline":"2026-11-25T09:40:00.000Z"}"#, moves: [String]? = nil, rounds: [String]? = nil
    ) -> String {
        let people = players ?? [player("sara.ghazal", name: "سارا", seat: 0, score: 1), player("niloofar", seat: 1)]
        let won = winner.map { "\"\($0)\"" } ?? "null"
        let why = reason.map { "\"\($0)\"" } ?? "null"
        let extra = (moves.map { #","moves":[\#($0.joined(separator: ","))]"# } ?? "") + (rounds.map { #","rounds":[\#($0.joined(separator: ","))]"# } ?? "")
        return """
        {"id":"\(id)","kind":"\(kind)","turnSeconds":\(turnSeconds),"status":"\(status)","code":"M4R9","createdAt":"2026-11-24T09:00:00.000Z","endedAt":null,\
        "winner":\(won),"endReason":\(why),"players":[\(people.joined(separator: ","))],"turn":\(turn ?? "null")\(extra)}
        """
    }

    static func decoded(_ json: String) throws -> FriendGame { try JSONDecoder().decode(FriendGame.self, from: Data(json.utf8)) }

    /// «یاد باد آن که نهانت نظری با ما بود / رقم مهر تو بر چهره‌ی ما پیدا بود»: ends with د.
    static let sara = move(n: 1, by: "sara.ghazal", key: "/hafez/ghazal/sh2#0", m1: "یاد باد آن که نهانت نظری با ما بود", m2: "رقم مهر تو بر چهره‌ی ما پیدا بود")
}

struct FriendGameTests {
    @Test func aGameWithItsMovesIsDecoded() throws {
        let game = try GameJSON.decoded(GameJSON.game(moves: [GameJSON.sara]))
        #expect(game.kind == .mosh && game.status == .active && game.turnSeconds == 86_400)
        #expect(game.players.map(\.name) == ["سارا", "niloofar"])
        #expect(game.turn?.username == "niloofar")
        #expect(game.moves.map(\.key) == ["/hafez/ghazal/sh2#0"])
        #expect(game.rounds.isEmpty)
    }

    @Test func aSummaryHasNoMovesOrRounds() throws {
        let game = try GameJSON.decoded(GameJSON.game(turn: nil))
        #expect(game.moves.isEmpty && game.rounds.isEmpty && game.turn == nil)
    }

    @Test func gameEventsAreDecoded() throws {
        let started = LiveEvent.decode(#"{"type":"game.started","game":\#(GameJSON.game(status: "active"))}"#)
        guard case .gameStarted(let game)? = started else { throw Failure() }
        #expect(game.id == "g1")

        let scores = #"[{"username":"sara.ghazal","score":2},{"username":"niloofar","score":1}]"#
        let move = #"{"type":"game.move","gameId":"g1","move":\#(GameJSON.sara),"scores":\#(scores)}"#
        guard case .gameMove("g1", let played, let moveScores)? = LiveEvent.decode(move) else { throw Failure() }
        #expect(played.n == 1 && moveScores.map(\.score) == [2, 1])

        guard case .gameTurn("g1", "niloofar", let deadline)? = LiveEvent.decode(#"{"type":"game.turn","gameId":"g1","username":"niloofar","deadline":"2026-11-25T09:40:00.000Z"}"#) else { throw Failure() }
        #expect(deadline == DivanTime.date(DivanTime.milliseconds("2026-11-25T09:40:00.000Z")!))

        guard case .gameEnded("g1", "sara.ghazal", .left, _, let couplets)? = LiveEvent.decode(#"{"type":"game.ended","gameId":"g1","winner":"sara.ghazal","reason":"left","scores":\#(scores)}"#) else { throw Failure() }
        #expect(couplets.isEmpty)
    }

    @Test func duelEventsAreDecoded() throws {
        let question = #"{"type":"duel.question","gameId":"g1","round":4,"rounds":5,"kind":"second","couplet":{"m1":"توانا بود هر که دانا بود"},"poet":"فردوسی","options":["الف","ب","ج"],"deadlineMs":8000}"#
        guard case .duelQuestion(let asked)? = LiveEvent.decode(question) else { throw Failure() }
        #expect(asked.round == 4 && asked.kind == .second && asked.m2 == nil && asked.poet == "فردوسی" && asked.options.count == 3 && asked.deadlineMs == 8000)
        #expect(LiveEvent.decode(#"{"type":"duel.answered","gameId":"g1","round":4,"username":"sara.ghazal"}"#) == .duelAnswered(gameId: "g1", round: 4, username: "sara.ghazal"))
        let round = LiveEvent.decode(#"{"type":"duel.round","gameId":"g1","round":4,"winner":null,"rightOption":2,"scores":[{"username":"niloofar","score":2}]}"#)
        #expect(round == .duelRound(gameId: "g1", round: 4, winner: nil, rightOption: 2, scores: [GameScore(username: "niloofar", score: 2)]))
        let result = LiveEvent.decode(#"{"type":"challenge.result","code":"7KQ2","game":"jigsaw","result":{"name":"کیان","username":null,"score":9,"seconds":80}}"#)
        #expect(result == .challengeResult(code: "7KQ2", game: .jigsaw, result: ChallengeLiveResult(name: "کیان", username: nil, score: 9, seconds: 80)))
    }

    @Test func theAnswerFrameIsWhatTheServerReads() throws {
        let frame = LiveEvent.duelAnswerFrame(gameId: "g1", round: 2, option: 3)
        let json = try #require(JSONSerialization.jsonObject(with: Data(frame.utf8)) as? [String: Any])
        #expect(json["type"] as? String == "duel.answer" && json["gameId"] as? String == "g1" && json["round"] as? Int == 2 && json["option"] as? Int == 3)
    }

    struct Failure: Error {}
}

struct MoshStateTests {
    private func state(_ json: String, me: String = "niloofar") throws -> MoshState {
        MoshState(game: try GameJSON.decoded(json), me: me)
    }

    @Test func whoseTurnTheScoresAndTheLetterComeFromTheGame() throws {
        let mosh = try state(GameJSON.game(moves: [GameJSON.sara]))
        #expect(mosh.isMyTurn)
        #expect(mosh.requiredLetter == "د")
        #expect(mosh.theirScore == 1 && mosh.myScore == 0)
        #expect(mosh.round == 2)
        #expect(mosh.roundLine == "دور ۲ · تا فردا")
        #expect(mosh.turnLine == "نوبت توئه، با حرف «د»")
        #expect(mosh.usedKeys == ["/hafez/ghazal/sh2#0"])
        #expect(mosh.other?.name == "سارا")
    }

    @Test func itIsNotMyTurnForTheOtherPlayer() throws {
        let theirs = try state(GameJSON.game(turn: #"{"username":"sara.ghazal","deadline":"2026-11-25T09:40:00.000Z"}"#, moves: [GameJSON.sara]))
        #expect(!theirs.isMyTurn)
        #expect(theirs.turnLine == "منتظر سارا…")
    }

    @Test func theFirstCoupletIsFree() throws {
        let first = try state(GameJSON.game(moves: []))
        #expect(first.requiredLetter == nil)
        #expect(first.turnLine == PlayCopy.myTurnFirst)
        #expect(first.round == 1)
    }

    @Test func aWaitingGameWaitsForTheOtherPlayer() throws {
        let waiting = try state(GameJSON.game(status: "waiting", players: [GameJSON.player("niloofar", seat: 0)], turn: nil))
        #expect(waiting.isWaiting && !waiting.isMyTurn && waiting.other == nil)
    }

    @Test func theTimeLeftIsHoursForADayAndAClockForShortTurns() throws {
        let day = try state(GameJSON.game(moves: [GameJSON.sara]))
        let deadline = try #require(day.game.turn?.deadline)
        #expect(day.timeLabel(now: deadline.addingTimeInterval(-21 * 3600 - 600)) == "۲۱ ساعت")
        #expect(day.timeLabel(now: deadline.addingTimeInterval(-45 * 60)) == "۴۵ دقیقه")
        #expect(day.timeLabel(now: deadline.addingTimeInterval(-30)) == "۰:۳۰")
        #expect(day.timeLabel(now: deadline.addingTimeInterval(60)) == "۰:۰۰")

        let quick = try state(GameJSON.game(turnSeconds: 30, turn: #"{"username":"niloofar","deadline":"2026-11-24T09:40:30.000Z"}"#))
        #expect(quick.timeLabel(now: DivanTime.date(DivanTime.milliseconds("2026-11-24T09:40:05.000Z")!)) == "۰:۲۵")
        #expect(quick.roundLine.hasSuffix("۳۰ ثانیه"))
    }

    @Test func aFinishedGameHasNoClockAndAnOutcome() throws {
        let won = try state(GameJSON.game(status: "done", winner: "niloofar", reason: "resigned", turn: nil, moves: [GameJSON.sara]))
        #expect(won.timeLabel(now: .now) == nil)
        #expect(won.outcome == .won && won.outcomeTitle == "بردی!")
        #expect(won.endLine == "سارا کم آورد")
        let lost = try state(GameJSON.game(status: "done", winner: "sara.ghazal", reason: "timeout", turn: nil))
        #expect(lost.outcomeTitle == "سارا برد" && lost.endLine == "وقتت تموم شد")
        let left = try state(GameJSON.game(status: "done", winner: "niloofar", reason: "left", turn: nil))
        #expect(left.endLine == "سارا رفت")
        let draw = try state(GameJSON.game(status: "done", turn: nil))
        #expect(draw.outcome == .draw && draw.outcomeTitle == "مساوی")
    }

    @Test func aRefusedMoveSaysWhy() {
        func error(_ code: APIErrorCode, _ status: Int = 409) -> APIError { .server(status: status, code: code, allowedAt: nil) }
        #expect(PlayCopy.moveError(error(.wrongLetter), letter: "د") == "با حرف «د» شروع نمی‌شه")
        #expect(PlayCopy.moveError(error(.alreadyPlayed), letter: "د") == "این بیت رو قبلاً گفتید")
        #expect(PlayCopy.moveError(error(.turnOver), letter: "د") == "وقتت تموم شد")
        #expect(PlayCopy.moveError(error(.badCouplet, 400), letter: "د") == "این بیت با متن گنجور نمی‌خونه")
        #expect(PlayCopy.moveError(.network, letter: "د") == APIError.network.persianMessage)
    }
}
