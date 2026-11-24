import Foundation
import Testing
@testable import Yebeyt

@MainActor
private func session(_ stub: StubServer) -> Session {
    Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"), fake: APIUser(
        id: "u1", username: "niloofar", displayName: "نیلوفر", usernameChangedAt: nil, createdAt: "2026-11-23T08:00:00.000Z", providers: [.apple]
    ))
}

private func people(_ names: [String]) -> String {
    let items = names.map { #"{"username":"\#($0)","displayName":null,"avatar":null,"isFriend":true}"# }
    return #"{"items":[\#(items.joined(separator: ","))],"nextCursor":null}"#
}

/// GameLobby: what the choices become.
@MainActor
struct LobbyModelTests {
    private func lobby(_ start: LobbyStart = LobbyStart(), friends: [String] = ["sara.ghazal", "kian_k", "mahsa.m", "bardia"]) async -> (LobbyModel, StubServer) {
        let stub = StubServer { request in
            request.path == "/v1/me/friends" ? .json(200, people(friends)) : .json(201, #"{"game":\#(GameJSON.game(id: "made", status: "waiting", turn: nil)),"invited":[],"skipped":[]}"#)
        }
        let model = LobbyModel(start: start, session: session(stub))
        await model.loadFriends()
        return (model, stub)
    }

    @Test func moshHasATurnTimeAndTheInvitedUsernames() async {
        let (model, _) = await lobby()
        model.toggle("sara.ghazal")
        model.toggle("kian_k")
        model.turnSeconds = 120
        #expect(model.plan == .friendGame(kind: .mosh, turnSeconds: 120, invite: ["sara.ghazal", "kian_k"]))
    }

    @Test func theTurnTimeStartsAtTomorrowAndOnlyMoshHasOne() async {
        let (model, _) = await lobby()
        #expect(model.turnSeconds == 86_400 && LobbyGame.mosh.hasTurnTime)
        #expect(LobbyModel.turnChoices == [30, 120, 86_400])
        model.game = .duel
        #expect(model.plan == .friendGame(kind: .duel, turnSeconds: nil, invite: []))
        #expect(!LobbyGame.duel.hasTurnTime && !LobbyGame.jigsaw.hasTurnTime && !LobbyGame.poet.hasTurnTime)
    }

    @Test func jigsawAndPoetAreChallengesPlayedFirst() async throws {
        let (model, stub) = await lobby(LobbyStart(game: .jigsaw, friend: PersonShort(username: "sara.ghazal", displayName: "سارا", avatar: nil)))
        #expect(model.plan == .challenge(.jigsaw, invite: ["sara.ghazal"]))
        model.game = .poet
        #expect(model.plan == .challenge(.poet, invite: ["sara.ghazal"]))
        let made = try await model.makeGame(using: FriendGames(session: session(stub)))
        #expect(made == nil)  // no game is made on the server for a challenge
        #expect(stub.requests.filter { $0.path == "/v1/games" }.isEmpty)
    }

    @Test func aFriendFromTheChatIsFirstAndChosen() async {
        let sara = PersonShort(username: "sara.ghazal", displayName: "سارا", avatar: nil)
        let (model, _) = await lobby(LobbyStart(game: .duel, friend: sara), friends: ["kian_k", "sara.ghazal", "mahsa.m", "bardia"])
        #expect(model.game == .duel)
        #expect(model.selected == ["sara.ghazal"])
        #expect(model.people.map(\.username) == ["sara.ghazal", "kian_k", "mahsa.m"])
    }

    @Test func theRowShowsThreeFriendsAndWhoWasFoundWithMore() async {
        let (model, _) = await lobby()
        #expect(model.people.map(\.username) == ["sara.ghazal", "kian_k", "mahsa.m"])
        let found = FoundPerson(username: "arian", displayName: "آرین", avatar: nil, isFollowing: true, isFriend: false)
        #expect(model.add(found))
        #expect(model.people.map(\.username).last == "arian" && model.selected == ["arian"])
    }

    @Test func atMostFivePeopleAreInvited() async {
        let (model, _) = await lobby()
        for name in ["a1", "a2", "a3", "a4", "a5"] { #expect(model.toggle(name)) }
        #expect(!model.toggle("a6"))
        #expect(model.selected.count == 5)
        #expect(model.toggle("a3"))  // letting go is always possible
        #expect(model.selected == ["a1", "a2", "a4", "a5"])
    }

    @Test func theGameIsMadeOnceForTheLinkAndTheButton() async throws {
        let (model, stub) = await lobby()
        model.toggle("sara.ghazal")
        #expect(model.linkText == "yebeyt.com/g/…")
        let games = FriendGames(session: session(stub))
        let first = try await model.makeGame(using: games)
        let second = try await model.makeGame(using: games)
        #expect(first?.id == "made" && second?.id == "made")
        #expect(stub.requests.filter { $0.path == "/v1/games" }.count == 1)
        #expect(model.linkText == "yebeyt.com/g/M4R9")
        let sent = try #require(stub.requests.first { $0.path == "/v1/games" })
        #expect(sent.json["invite"] as? [String] == ["sara.ghazal"] && sent.json["turnSeconds"] as? Int == 86_400)
    }

    @Test func changingTheGameOrTheTimeMakesANewOneNextTime() async throws {
        let (model, stub) = await lobby()
        let games = FriendGames(session: session(stub))
        _ = try await model.makeGame(using: games)
        model.turnSeconds = 30
        #expect(model.made == nil)
        _ = try await model.makeGame(using: games)
        #expect(stub.requests.filter { $0.path == "/v1/games" }.count == 2)
    }

    @Test func duelLeavesTheTurnTimeOutOfTheRequest() async throws {
        let (model, stub) = await lobby(LobbyStart(game: .duel))
        _ = try await model.makeGame(using: FriendGames(session: session(stub)))
        let sent = try #require(stub.requests.first { $0.path == "/v1/games" })
        #expect(sent.json["kind"] as? String == "duel" && sent.json["turnSeconds"] == nil)
    }
}

/// ChallengeSend and ChallengeAccept.
@MainActor
struct ChallengeModelTests {
    private let items = (0..<10).map { "/saadi/divan/ghazals/sh\($0 + 1)#0" }

    private func offer(invite: [String] = []) -> ChallengeOffer {
        let couplets = items.map { key -> GameCouplet in
            let parts = key.split(separator: "#")
            return GameCouplet(poem: String(parts[0]), index: 0, m1: "بنی آدم اعضای یکدیگرند", m2: "که در آفرینش ز یک گوهرند", meaning: nil, poetSlug: "saadi", poetName: "سعدی", bookTitle: "")
        }
        var made = ChallengeOffer(game: .jigsaw, couplets: couplets, score: 8, seconds: 102)!
        made.invite = invite
        return made
    }

    private func sender(_ stub: StubServer, offer: ChallengeOffer, sent: Recorded<String>) -> ChallengeSender {
        ChallengeSender(offer: offer, session: session(stub), name: "نیلوفر") { text, username in
            sent.add("\(username): \(text)")
            return nil
        }
    }

    @Test func aRoundOfTenIsAChallengeOfItsGameItsScoreAndItsTime() {
        #expect(offer().items == items && offer().score == 8 && offer().seconds == 102)
        #expect(offer().label == "۱۰ بیت سعدی")
        #expect(ChallengeOffer(game: .poet, couplets: [], score: 1, seconds: 1) == nil)
    }

    @Test func theChallengeIsMadeOnceWhateverHowOftenTheCardShows() async throws {
        let stub = StubServer { _ in .json(201, #"{"code":"7KQ2","url":"https://yebeyt.com/c/7KQ2"}"#) }
        let sent = Recorded<String>()
        let sender = sender(stub, offer: offer(), sent: sent)
        await sender.create()
        await sender.create()
        #expect(stub.requests.filter { $0.path == "/v1/challenges" }.count == 1)
        #expect(sender.created?.code == "7KQ2" && sender.linkText == "yebeyt.com/c/7KQ2")
        let body = try #require(stub.requests.first).json
        #expect(body["game"] as? String == "jigsaw" && body["items"] as? [String] == items && body["score"] as? Int == 8 && body["seconds"] as? Int == 102)
    }

    @Test func theTextOfTheCardAndTheShareFollowTheBoard() async {
        let stub = StubServer { _ in .json(201, #"{"code":"7KQ2","url":"https://yebeyt.com/c/7KQ2"}"#) }
        let sender = sender(stub, offer: offer(), sent: Recorded())
        #expect(sender.share == nil && sender.linkText == "yebeyt.com/c/····")
        await sender.create()
        #expect(sender.brag == "نیلوفر توی جورچین بیت ۸ از ۱۰ گرفت. تو چند می‌گیری؟")
        #expect(sender.share == SharePayload(text: "\(sender.brag)\nhttps://yebeyt.com/c/7KQ2", url: "https://yebeyt.com/c/7KQ2"))
    }

    @Test func theFriendsPickedInTheLobbyGetTheLinkAsAChatMessage() async {
        let stub = StubServer { _ in .json(201, #"{"code":"7KQ2","url":"https://yebeyt.com/c/7KQ2"}"#) }
        let sent = Recorded<String>()
        let sender = sender(stub, offer: offer(invite: ["sara.ghazal", "kian_k"]), sent: sent)
        await sender.create()
        await sender.create()
        #expect(sent.all == [
            "sara.ghazal: نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2", "kian_k: نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2",
        ])
        #expect(sender.sent == ["sara.ghazal", "kian_k"])
    }

    @Test func aFriendChosenOnTheCardGetsItOnceAndNothingIsSentBeforeItExists() async {
        let stub = StubServer { _ in .json(201, #"{"code":"7KQ2","url":"https://yebeyt.com/c/7KQ2"}"#) }
        let sent = Recorded<String>()
        let sender = sender(stub, offer: offer(), sent: sent)
        #expect(await sender.send(to: "sara.ghazal") == PlayCopy.challengePending)
        await sender.create()
        #expect(await sender.send(to: "sara.ghazal") == nil)
        #expect(await sender.send(to: "sara.ghazal") == nil)
        #expect(sent.all.count == 1)
    }

    @Test func aChallengeThatFailedIsTriedAgain() async {
        let calls = Recorded<Int>()
        let stub = StubServer { _ in
            calls.add(1)
            return calls.all.count == 1 ? .json(429, #"{"error":"rate_limited"}"#) : .json(201, #"{"code":"7KQ2","url":"https://yebeyt.com/c/7KQ2"}"#)
        }
        let sender = sender(stub, offer: offer(), sent: Recorded())
        await sender.create()
        #expect(sender.phase == .failed(APIError.server(status: 429, code: .rateLimited, allowedAt: nil).persianMessage))
        await sender.create()
        #expect(sender.created?.code == "7KQ2")
    }

    // MARK: Accepting

    private var challengeJSON: String {
        let keys = items.map { "\"\($0)\"" }.joined(separator: ",")
        return #"{"creator":{"username":"nila","displayName":"نیلوفر","avatar":null},"game":"jigsaw","items":[\#(keys)],"score":8,"seconds":102,"label":"۱۰ بیت سعدی"}"#
    }

    @Test func aChallengeIsLoadedWithoutAnAccount() async throws {
        let json = challengeJSON
        let stub = StubServer { _ in .json(200, json) }
        let guest = Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"))
        let accept = ChallengeAccept(code: "7KQ2", session: guest)
        await accept.load()
        #expect(accept.challenge?.creator.name == "نیلوفر" && accept.challenge?.items == items && accept.challenge?.score == 8)
        #expect(stub.requests.first?.authorization == nil && stub.requests.first?.path == "/v1/challenges/7KQ2")
        #expect(accept.asksName)
    }

    @Test func anUnknownOrExpiredCodeSaysSo() async {
        let stub = StubServer { _ in .json(404, #"{"error":"not_found"}"#) }
        let accept = ChallengeAccept(code: "ZZZZ", session: session(stub))
        await accept.load()
        #expect(accept.phase == .failed(PlayCopy.challengeGone))
    }

    @Test func aGuestLeavesTheNameWithTheResultAndNoToken() async throws {
        let stub = StubServer { _ in .json(201, #"{"id":"r1"}"#) }
        let guest = Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"))
        let accept = ChallengeAccept(code: "7KQ2", session: guest)
        #expect(await accept.post(score: 7, seconds: 90, name: "  کیان  ") == nil)
        let sent = try #require(stub.requests.first)
        #expect(sent.path == "/v1/challenges/7KQ2/results" && sent.authorization == nil)
        #expect(sent.json["name"] as? String == "کیان" && sent.json["score"] as? Int == 7 && sent.json["seconds"] as? Int == 90)
    }

    @Test func aGuestWithoutANameSendsNothing() async {
        let stub = StubServer { _ in .json(201, #"{"id":"r1"}"#) }
        let guest = Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"))
        let accept = ChallengeAccept(code: "7KQ2", session: guest)
        #expect(await accept.post(score: 7, seconds: 90, name: "   ") == PlayCopy.nameNeeded)
        #expect(await accept.post(score: 7, seconds: 90, name: nil) == PlayCopy.nameNeeded)
        #expect(stub.requests.isEmpty)
    }

    @Test func theNameIsCutToThirtyCharacters() {
        #expect(ChallengeAccept.cleaned(String(repeating: "ا", count: 40))?.count == 30)
        #expect(ChallengeAccept.cleaned("\n ") == nil)
    }

    @Test func aSignedInPlayerPostsWithTheAccountAndNoName() async throws {
        let stub = StubServer { _ in .json(201, #"{"id":"r1"}"#) }
        let accept = ChallengeAccept(code: "7KQ2", session: session(stub))
        #expect(!accept.asksName)
        #expect(await accept.post(score: 9, seconds: 80, name: nil) == nil)
        let sent = try #require(stub.requests.first)
        #expect(sent.authorization == "Bearer debug-access-token" && sent.json["name"] == nil)
    }

    @Test func aSecondResultIsSaidToBeThereAlready() async {
        let stub = StubServer { _ in .json(409, #"{"error":"conflict"}"#) }
        let accept = ChallengeAccept(code: "7KQ2", session: session(stub))
        #expect(await accept.post(score: 9, seconds: 80, name: nil) == PlayCopy.alreadyAnswered)
    }

    @Test func moreThanTheMakersScoreWins() {
        #expect(ChallengeAccept.outcome(mine: 9, theirs: 8) == .won)
        #expect(ChallengeAccept.outcome(mine: 8, theirs: 8) == .draw)
        #expect(ChallengeAccept.outcome(mine: 7, theirs: 8) == .lost)
        #expect(PlayCopy.scores(mine: 7, name: "نیلوفر", theirs: 8) == "تو ۷ · نیلوفر ۸")
        #expect(PlayCopy.toWin(over: 8) == "بیشتر از ۸ تا بگیری، تو بردی.")
    }

    @Test func theMessagesAreWhatTheBoardsSay() {
        #expect(PlayCopy.fromLink("نیلوفر") == "از لینک نیلوفر")
        #expect(PlayCopy.waitingForYou("نیلوفر") == "نیلوفر منتظرته")
        #expect(PlayCopy.outOfTen(8) == "۸ از ۱۰")
        #expect(PlayCopy.challengeResult(from: "سارا", score: 7) == "سارا توی چالشت ۷ از ۱۰ گرفت")
    }

    @Test func theChallengesCoupletsAreFoundInTheDeckByKeyInOrder() {
        // The round of a challenge is exactly its items: the jigsaw takes them as its opening, in order.
        let deck = QuizFixtures.deck()
        let wanted = [deck.couplets[5], deck.couplets[2], deck.couplets[40]]
        var generator = SeededGenerator(seed: 3)
        let round = JigsawRound.make(opening: wanted, deck: deck, generator: &generator)
        #expect(round?.questions.prefix(3).map(\.couplet.id) == wanted.map(\.id))
        let poets = QuizRound.poet(couplets: wanted, poets: QuizFixtures.poets, generator: &generator)
        #expect(poets?.questions.map(\.couplet.id) == wanted.map(\.id))
    }
}
