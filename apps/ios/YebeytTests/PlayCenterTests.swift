import Foundation
import Testing
@testable import Yebeyt

/// The states of رودررو as the live events tell them.
struct DuelStateTests {
    private func state() -> DuelState { DuelState(gameID: "d1", me: "niloofar", other: "sara.ghazal") }

    private func question(_ round: Int, kind: DuelKind = .second, options: Int = 3, deadlineMs: Int = 8000) -> LiveEvent {
        .duelQuestion(DuelQuestion(
            gameId: "d1", round: round, rounds: 5, kind: kind, m1: "توانا بود هر که دانا بود", m2: nil, poet: "فردوسی",
            options: (0..<options).map { "گزینه \($0)" }, deadlineMs: deadlineMs
        ))
    }

    private func result(_ round: Int, winner: String?, right: Int = 1, scores: [(String, Int)] = []) -> LiveEvent {
        .duelRound(gameId: "d1", round: round, winner: winner, rightOption: right, scores: scores.map { GameScore(username: $0.0, score: $0.1) })
    }

    @Test func beforeTheFirstQuestionThereIsNothingToAnswer() {
        let duel = state()
        #expect(duel.question == nil && duel.round == 0 && !duel.canAnswer && !duel.isEnded)
        #expect(duel.segments == [.current, .coming, .coming, .coming, .coming])
    }

    @Test func aQuestionOpensTheRoundAndTheClockCountsDown() {
        var duel = state()
        let start = Date(timeIntervalSince1970: 1000)
        duel.apply(question(1), now: start)
        #expect(duel.round == 1 && duel.canAnswer)
        #expect(duel.secondsLeft(now: start) == 8)
        #expect(duel.secondsLeft(now: start.addingTimeInterval(2.4)) == 6)
        #expect(duel.secondsLeft(now: start.addingTimeInterval(20)) == 0)
    }

    @Test func aReconnectBringsTheQuestionWithTheTimeThatIsLeft() {
        var duel = state()
        let start = Date(timeIntervalSince1970: 1000)
        duel.apply(question(2, deadlineMs: 3000), now: start)
        #expect(duel.secondsLeft(now: start) == 3)
    }

    @Test func myAnswerIsKeptAndSentOnlyOnce() {
        var duel = state()
        duel.apply(question(1))
        let first = duel.choose(2)
        #expect(first && duel.chosen == 2 && !duel.canAnswer)
        let second = duel.choose(0)  // one answer for each round
        #expect(!second && duel.chosen == 2)
    }

    @Test func anOptionThatIsNotThereIsNotChosen() {
        var duel = state()
        duel.apply(question(1, options: 3))
        let chosen = duel.choose(3)
        #expect(!chosen && duel.chosen == nil)
    }

    @Test func aWrongAnswerLocksMeOutOfTheRound() {
        var duel = state()
        duel.apply(question(1))
        duel.choose(0)
        duel.apply(.duelAnswered(gameId: "d1", round: 1, username: "niloofar"))
        #expect(duel.lockedOut && !duel.otherAnswered && !duel.canAnswer)
    }

    @Test func theOtherPlayersWrongAnswerShowsTheChipAndLeavesMeFree() {
        var duel = state()
        duel.apply(question(1))
        duel.apply(.duelAnswered(gameId: "d1", round: 1, username: "sara.ghazal"))
        #expect(duel.otherAnswered && !duel.lockedOut && duel.canAnswer)
    }

    @Test func aRoundResultShowsTheRightOptionAndEndsTheAnswering() {
        var duel = state()
        duel.apply(question(1))
        duel.apply(result(1, winner: "sara.ghazal", right: 2, scores: [("niloofar", 0), ("sara.ghazal", 1)]))
        #expect(duel.isRoundOver && duel.rightOption == 2 && !duel.canAnswer)
        #expect(duel.roundWinner == "sara.ghazal")
        #expect(duel.theirScore == 1 && duel.myScore == 0)
    }

    @Test func aQuestionAskedAgainForTheSameRoundKeepsMyAnswerAndLockout() {
        var duel = state()
        let start = Date(timeIntervalSince1970: 1000)
        duel.apply(question(2), now: start)
        duel.choose(1)
        duel.apply(.duelAnswered(gameId: "d1", round: 2, username: "niloofar"))
        duel.apply(.duelAnswered(gameId: "d1", round: 2, username: "sara.ghazal"))
        duel.apply(question(2, deadlineMs: 4000), now: start.addingTimeInterval(4))  // the socket came back: the time left is sent
        #expect(duel.chosen == 1 && duel.lockedOut && duel.otherAnswered && !duel.canAnswer)
        #expect(duel.secondsLeft(now: start.addingTimeInterval(4)) == 4)
    }

    @Test func aChoiceThatWasNotSentCanBeTakenBack() {
        var duel = state()
        duel.apply(question(1))
        duel.choose(0)
        duel.undoChoice()
        #expect(duel.chosen == nil && duel.canAnswer)
        duel.choose(1)
        duel.apply(.duelAnswered(gameId: "d1", round: 1, username: "niloofar"))
        duel.undoChoice()  // a wrong answer the server knows about stays
        #expect(duel.chosen == 1 && duel.lockedOut)
    }

    @Test func theNextQuestionStartsFresh() {
        var duel = state()
        duel.apply(question(1))
        duel.choose(0)
        duel.apply(.duelAnswered(gameId: "d1", round: 1, username: "niloofar"))
        duel.apply(result(1, winner: nil))
        duel.apply(question(2))
        #expect(duel.round == 2 && duel.chosen == nil && !duel.lockedOut && !duel.otherAnswered && duel.rightOption == nil && duel.canAnswer)
    }

    @Test func theRoundStripShowsWhoWonEachRound() {
        var duel = state()
        duel.apply(result(1, winner: "niloofar"))
        duel.apply(result(2, winner: "sara.ghazal"))
        duel.apply(result(3, winner: nil))
        duel.apply(question(4))
        #expect(duel.segments == [.won(by: "niloofar"), .won(by: "sara.ghazal"), .nobody, .current, .coming])
    }

    @Test func eventsOfAnotherGameAreIgnored() {
        var duel = state()
        duel.apply(.duelQuestion(DuelQuestion(gameId: "other", round: 1, rounds: 5, kind: .second, m1: "x", m2: nil, poet: nil, options: ["a"], deadlineMs: 8000)))
        duel.apply(.duelRound(gameId: "other", round: 1, winner: "niloofar", rightOption: 0, scores: []))
        #expect(duel.question == nil && duel.winners.isEmpty)
    }

    @Test func aLateAnsweredEventOfAnEarlierRoundIsIgnored() {
        var duel = state()
        duel.apply(question(2))
        duel.apply(.duelAnswered(gameId: "d1", round: 1, username: "niloofar"))
        #expect(!duel.lockedOut)
    }

    // MARK: The end

    private func ended(winner: String?, reason: FriendGame.EndReason = .finished, couplets: [DuelResult] = []) -> LiveEvent {
        .gameEnded(gameId: "d1", winner: winner, reason: reason, scores: [GameScore(username: "niloofar", score: 3), GameScore(username: "sara.ghazal", score: 2)], couplets: couplets)
    }

    private func couplet(_ round: Int, winner: String?) -> DuelResult {
        DuelResult(round: round, type: .second, key: "/hafez/ghazal/sh\(round)#0", m1: "الف", m2: "ب", meaning: "معنی \(round)", poet: "hafez", bookTitle: "غزلیات", winner: winner)
    }

    @Test func theEndHasATitleForEachResult() {
        var won = state(), lost = state(), draw = state(), left = state()
        won.apply(ended(winner: "niloofar"))
        lost.apply(ended(winner: "sara.ghazal"))
        draw.apply(ended(winner: nil))
        left.apply(ended(winner: "niloofar", reason: .left))
        #expect(won.endTitle(otherName: "سارا") == "بردی!")
        #expect(lost.endTitle(otherName: "سارا") == "سارا برد")
        #expect(draw.endTitle(otherName: "سارا") == "مساوی")
        #expect(left.endTitle(otherName: "سارا") == "سارا رفت")
        #expect(won.isEnded && won.myScore == 3)
    }

    @Test func theSummaryHasTheCoupletsWithTheirMeaningsAndWhoWonEach() throws {
        var duel = state()
        duel.apply(ended(winner: "niloofar", couplets: [couplet(1, winner: "niloofar"), couplet(2, winner: "sara.ghazal"), couplet(3, winner: nil)]))
        let summary = try #require(duel.summary(otherName: "سارا", poetName: { _ in "حافظ" }))
        #expect(summary.title == "بردی!" && !summary.showsPoints && summary.showsMeanings)
        #expect(summary.right == 3 && summary.total == 5)
        #expect(summary.subtitle == "تو ۳ · سارا ۲")
        #expect(summary.rows.map(\.result) == [true, false, nil])
        #expect(summary.rows[0].couplet.meaning == "معنی 1" && summary.rows[0].couplet.poetName == "حافظ" && summary.rows[0].couplet.poem == "/hafez/ghazal/sh1")
        #expect(state().summary(otherName: "سارا", poetName: { $0 }) == nil)  // not over
    }
}

/// The games of this phone: reading, playing, and the live events.
@MainActor
struct FriendGamesTests {
    private func rig(_ handler: @escaping @Sendable (StubServer.Request) -> StubServer.Response) -> (games: FriendGames, stub: StubServer) {
        let stub = StubServer(handler)
        let session = Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"), fake: APIUser(
            id: "u1", username: "niloofar", displayName: nil, usernameChangedAt: nil, createdAt: "2026-11-23T08:00:00.000Z", providers: [.apple]
        ))
        return (FriendGames(session: session, now: { MessageClock.now }), stub)
    }

    private let mosh = GameJSON.game(moves: [GameJSON.sara])
    private func candidate(_ key: String = "/hafez/ghazal/sh9#0") -> MoshCandidate {
        MoshCandidate(CoupletEntry(path: String(key.split(separator: "#")[0]), index: 0, couplet: Couplet(m1: "دل می‌رود", m2: "خدا را"), poet: "hafez", title: "غزل ۹", popularity: 0, text: "دل می رود خدا را"))
    }

    @Test func aGameIsReadAndKept() async {
        let (games, stub) = rig { _ in .json(200, GameJSON.game(moves: [GameJSON.sara])) }
        let game = await games.load("g1")
        #expect(game?.moves.count == 1 && games.game("g1")?.id == "g1")
        #expect(stub.requests.first?.path == "/v1/games/g1")
    }

    @Test func myListFindsTheGameWhereItIsMyTurnFirst() async {
        let soon = GameJSON.game(id: "soon", turn: #"{"username":"niloofar","deadline":"2026-11-24T10:00:00.000Z"}"#)
        let later = GameJSON.game(id: "later", turn: #"{"username":"niloofar","deadline":"2026-11-25T10:00:00.000Z"}"#)
        let theirs = GameJSON.game(id: "theirs", turn: #"{"username":"sara.ghazal","deadline":"2026-11-24T09:30:00.000Z"}"#)
        let (games, _) = rig { _ in .json(200, #"{"items":[\#(later),\#(theirs),\#(soon)]}"#) }
        #expect(games.urgentMosh == nil)
        await games.refreshMine()
        #expect(games.mineIDs == ["later", "theirs", "soon"])
        #expect(games.urgentMosh?.id == "soon")
    }

    @Test func noGameOfMineWaitingForMeMeansNoUrgentGame() async {
        let theirs = GameJSON.game(id: "theirs", turn: #"{"username":"sara.ghazal","deadline":"2026-11-24T09:30:00.000Z"}"#)
        let (games, _) = rig { _ in .json(200, #"{"items":[\#(theirs)]}"#) }
        await games.refreshMine()
        #expect(games.urgentMosh == nil)
    }

    @Test func aMoveSendsTheCoupletAndKeepsTheAnswer() async throws {
        let after = GameJSON.game(turn: #"{"username":"sara.ghazal","deadline":"2026-11-25T09:40:00.000Z"}"#, moves: [GameJSON.sara])
        let (games, stub) = rig { request in request.path.hasSuffix("/moves") ? .json(200, after) : .json(200, GameJSON.game(moves: [GameJSON.sara])) }
        await games.load("g1")
        let line = await games.play(candidate(), in: "g1")
        #expect(line == nil)
        let sent = try #require(stub.requests.last)
        #expect(sent.path == "/v1/games/g1/moves" && sent.method == "POST")
        #expect(sent.json["key"] as? String == "/hafez/ghazal/sh9#0" && sent.json["m1"] as? String == "دل می‌رود" && sent.json["m2"] as? String == "خدا را")
        #expect(games.game("g1")?.turn?.username == "sara.ghazal")
    }

    @Test func aRefusedMoveGivesTheLineOfTheBoard() async {
        let (games, _) = rig { request in
            request.path.hasSuffix("/moves") ? .json(409, #"{"error":"wrong_letter"}"#) : .json(200, GameJSON.game(moves: [GameJSON.sara]))
        }
        await games.load("g1")
        #expect(await games.play(candidate(), in: "g1") == "با حرف «د» شروع نمی‌شه")
    }

    @Test func aTurnThatRanOutReadsTheGameAgain() async {
        let done = GameJSON.game(status: "done", winner: "sara.ghazal", reason: "timeout", turn: nil)
        let (games, stub) = rig { request in
            request.path.hasSuffix("/moves") ? .json(409, #"{"error":"turn_over"}"#) : .json(200, done)
        }
        await games.load("g1")
        #expect(await games.play(candidate(), in: "g1") == "وقتت تموم شد")
        #expect(games.game("g1")?.status == .done)
        #expect(stub.requests.filter { $0.method == "GET" }.count == 2)
    }

    @Test func resigningEndsTheGame() async {
        let done = GameJSON.game(status: "done", winner: "sara.ghazal", reason: "resigned", turn: nil)
        let (games, stub) = rig { request in request.path.hasSuffix("/resign") ? .json(200, done) : .json(200, GameJSON.game()) }
        await games.load("g1")
        #expect(await games.resign("g1") == nil)
        #expect(stub.requests.last?.path == "/v1/games/g1/resign")
        #expect(games.game("g1")?.endReason == .resigned)
    }

    @Test func joiningGoesByTheGamesIdAndAFullGameSaysSo() async {
        let (games, stub) = rig { request in
            request.path == "/v1/games/g1/join" ? .json(200, GameJSON.game(id: "g1")) : .json(409, #"{"error":"game_full"}"#)
        }
        #expect(await games.join("g1") == nil)
        #expect(stub.requests.last?.path == "/v1/games/g1/join" && games.game("g1") != nil)
        #expect(await games.join("g2") == "یکی دیگه زودتر اومده توی این بازی")
    }

    @Test func aMoveEventAddsTheCoupletTheScoresAndTheTurnComesAfter() async throws {
        let (games, _) = rig { _ in .json(200, GameJSON.game(turn: #"{"username":"sara.ghazal","deadline":"2026-11-24T09:41:00.000Z"}"#, moves: [])) }
        await games.load("g1")
        let move = try JSONDecoder().decode(MoshMove.self, from: Data(GameJSON.sara.utf8))
        let scores = [GameScore(username: "sara.ghazal", score: 1), GameScore(username: "niloofar", score: 0)]
        games.handle(.gameMove(gameId: "g1", move: move, scores: scores))
        games.handle(.gameMove(gameId: "g1", move: move, scores: scores))  // the same move twice changes nothing
        #expect(games.game("g1")?.moves.count == 1 && games.game("g1")?.player("sara.ghazal")?.score == 1)
        let deadline = DivanTime.date(DivanTime.milliseconds("2026-11-25T09:40:00.000Z")!)
        games.handle(.gameTurn(gameId: "g1", username: "niloofar", deadline: deadline))
        #expect(games.game("g1")?.turn == GameTurn(username: "niloofar", deadline: deadline))
    }

    @Test func anEndedEventClosesTheGame() async {
        let (games, _) = rig { _ in .json(200, GameJSON.game()) }
        await games.load("g1")
        games.handle(.gameEnded(gameId: "g1", winner: "niloofar", reason: .timeout, scores: [], couplets: []))
        let game = games.game("g1")
        #expect(game?.status == .done && game?.winner == "niloofar" && game?.endReason == .timeout && game?.turn == nil)
    }

    @Test func aStartedEventKeepsTheCoupletsAlreadyKnown() async {
        let (games, _) = rig { _ in .json(200, GameJSON.game(moves: [GameJSON.sara])) }
        await games.load("g1")
        games.handle(.gameStarted(try! GameJSON.decoded(GameJSON.game())))  // a summary: no moves
        #expect(games.game("g1")?.moves.count == 1)
    }

    @Test func aGuestsChallengeResultIsToasted() {
        let (games, _) = rig { _ in .json(404, "{}") }
        let toasts = Recorded<String>()
        games.toast = { toasts.add($0) }
        games.handle(.challengeResult(code: "7KQ2", game: .jigsaw, result: ChallengeLiveResult(name: "کیان", username: nil, score: 9, seconds: 80)))
        games.handle(.challengeResult(code: "7KQ2", game: .jigsaw, result: ChallengeLiveResult(name: "سارا", username: "sara.ghazal", score: 7, seconds: 80)))
        #expect(toasts.all == ["کیان توی چالشت ۹ از ۱۰ گرفت"])  // an account's result comes as a chat line too
    }

    // MARK: رودررو

    private let duel = GameJSON.game(id: "d1", kind: "duel", turnSeconds: 8, turn: nil)

    @Test func theDuelFollowsTheEventsAndSendsMyAnswerOverTheSocket() async throws {
        let (games, _) = rig { _ in .json(200, duel) }
        let sent = Recorded<String>()
        games.sendLive = { sent.add($0); return true }
        await games.load("d1")
        games.handle(.duelQuestion(DuelQuestion(gameId: "d1", round: 1, rounds: 5, kind: .second, m1: "x", m2: nil, poet: nil, options: ["a", "b", "c"], deadlineMs: 8000)))
        #expect(games.duel("d1")?.round == 1)
        await games.answer(1, in: "d1")
        await games.answer(2, in: "d1")  // a second answer is not sent
        #expect(games.duel("d1")?.chosen == 1)
        let frame = try #require(sent.all.first)
        #expect(sent.all.count == 1)
        let json = try #require(JSONSerialization.jsonObject(with: Data(frame.utf8)) as? [String: Any])
        #expect(json["type"] as? String == "duel.answer" && json["gameId"] as? String == "d1" && json["round"] as? Int == 1 && json["option"] as? Int == 1)
    }

    @Test func anAnswerThatCouldNotBeSentIsTakenBackAndToasted() async {
        let (games, _) = rig { _ in .json(200, duel) }
        let toasts = Recorded<String>()
        games.toast = { toasts.add($0) }
        games.sendLive = { _ in false }  // the socket is not open
        await games.load("d1")
        games.handle(.duelQuestion(DuelQuestion(gameId: "d1", round: 1, rounds: 5, kind: .second, m1: "x", m2: nil, poet: nil, options: ["a", "b"], deadlineMs: 8000)))
        await games.answer(0, in: "d1")
        #expect(games.duel("d1")?.chosen == nil && games.duel("d1")?.canAnswer == true)
        #expect(toasts.all == [PlayCopy.answerNotSent])
    }

    @Test func aReadAskedBeforeALiveEventDoesNotPutTheGameBack() async throws {
        let older = GameJSON.game(turn: #"{"username":"sara.ghazal","deadline":"2026-11-25T09:40:00.000Z"}"#, moves: [])  // before Sara's move: her turn
        let move = try JSONDecoder().decode(MoshMove.self, from: Data(GameJSON.sara.utf8))
        let gate = Recorded<Int>()
        let (games, _) = rig { _ in
            gate.add(1)
            Thread.sleep(forTimeInterval: 0.3)  // the answer is slow: the event comes first
            return .json(200, older)
        }
        let loading = Task { await games.load("g1") }
        #expect(await eventually { !gate.all.isEmpty })
        games.handle(.gameStarted(try GameJSON.decoded(GameJSON.game(moves: []))))
        games.handle(.gameMove(gameId: "g1", move: move, scores: [GameScore(username: "sara.ghazal", score: 1)]))
        games.handle(.gameTurn(gameId: "g1", username: "niloofar", deadline: .distantFuture))
        await loading.value
        #expect(games.game("g1")?.moves.count == 1 && games.game("g1")?.turn?.username == "niloofar")  // the older answer was dropped
    }

    @Test func aDuelWaitsForTheFriendAndStartsWhenTheyJoin() async throws {
        let waiting = GameJSON.game(id: "d1", kind: "duel", turnSeconds: 8, status: "waiting", players: [GameJSON.player("niloofar", seat: 0)], turn: nil)
        let (games, _) = rig { _ in .json(200, waiting) }
        await games.load("d1")
        #expect(games.duel("d1") == nil)  // nobody to play against: the screen says «منتظر دوستت…»
        games.handle(.gameStarted(try GameJSON.decoded(GameJSON.game(id: "d1", kind: "duel", turnSeconds: 8, turn: nil))))
        let started = try #require(games.duel("d1"))
        #expect(started.other == "sara.ghazal" && started.question == nil && !started.isEnded)  // started: «منتظر سارا…» until the first question
        #expect(games.mineIDs == ["d1"])
    }

    @Test func aDuelThatEndedWhileTheAppWasAwayHasItsEndFromTheGame() async throws {
        let round = #"{"round":1,"type":"second","key":"/hafez/ghazal/sh1#0","m1":"الف","m2":"ب","meaning":"م","poet":"hafez","bookTitle":"غزلیات","winner":"niloofar"}"#
        let done = GameJSON.game(id: "d1", kind: "duel", turnSeconds: 8, status: "done", winner: "niloofar", reason: "left", turn: nil, rounds: [round])
        let (games, _) = rig { _ in .json(200, done) }
        await games.load("d1")
        let state = try #require(games.duel("d1"))
        #expect(state.isEnded && state.endTitle(otherName: "سارا") == "سارا رفت" && state.ending?.couplets.count == 1)
    }

    @Test func gamesAreForgottenOnSignOut() async {
        let (games, _) = rig { _ in .json(200, GameJSON.game()) }
        await games.load("g1")
        games.reset()
        #expect(games.game("g1") == nil && games.mineIDs.isEmpty)
    }

    @Test func aGameIsMadeWithItsInvitationsAndKeptInMyList() async throws {
        let created = #"{"game":\#(GameJSON.game(status: "waiting", turn: nil)),"invited":["sara.ghazal"],"skipped":[]}"#
        let (games, stub) = rig { _ in .json(201, created) }
        let made = try await games.create(kind: .mosh, turnSeconds: 30, invite: ["sara.ghazal"])
        #expect(made.invited == ["sara.ghazal"] && games.game("g1")?.status == .waiting && games.mineIDs == ["g1"])
        let sent = try #require(stub.requests.first)
        #expect(sent.path == "/v1/games" && sent.json["kind"] as? String == "mosh" && sent.json["turnSeconds"] as? Int == 30 && sent.json["invite"] as? [String] == ["sara.ghazal"])
    }
}

/// Sending a text to a person from a card, without leaving the screen.
@MainActor
struct SendTextTests {
    @Test func theChatIsFoundThenTheTextIsSent() async throws {
        let stub = StubServer { request in
            switch request.path {
            case "/v1/conversations": .json(200, #"{"id":"c1","other":\#(MessageJSON.person)}"#)
            case "/v1/conversations/c1/messages": .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "سلام"))
            default: .json(404, "{}")
            }
        }
        let center = MessagesCenter(session: signedInSession(stub.api))
        #expect(await center.sendText("سلام", to: "sara") == nil)
        #expect(stub.requests.map(\.path) == ["/v1/conversations", "/v1/conversations/c1/messages"])
        #expect(stub.requests[0].json["username"] as? String == "sara")
        let sent = stub.requests[1].json
        #expect(sent["kind"] as? String == "text" && sent["text"] as? String == "سلام" && (sent["clientId"] as? String)?.isEmpty == false)
    }

    @Test func aClosedChatGivesItsLine() async {
        let stub = StubServer { _ in .json(403, #"{"error":"messages_closed"}"#) }
        let center = MessagesCenter(session: signedInSession(stub.api))
        #expect(await center.sendText("سلام", to: "sara") == MessageCopy.closed)
    }

    @Test func aLiveFrameGoesNowhereWhileTheSocketIsClosed() async {
        let center = MessagesCenter(session: signedInSession(StubServer().api))
        #expect(await center.sendLive("x") == false)
    }

    @Test func liveEventsAreHandedToTheGamesAfterTheMessages() {
        let center = MessagesCenter(session: signedInSession(StubServer().api))
        let seen = Recorded<LiveEvent>()
        center.onLive = { seen.add($0) }
        center.handle(.presence(username: "sara", online: true))
        center.handle(.duelAnswered(gameId: "d1", round: 1, username: "sara"))
        #expect(seen.all == [.presence(username: "sara", online: true), .duelAnswered(gameId: "d1", round: 1, username: "sara")])
    }
}
