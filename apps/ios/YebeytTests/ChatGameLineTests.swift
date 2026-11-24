import Foundation
import Testing
@testable import Yebeyt

/// The game lines of a chat: what each message draws.
struct ChatGameLineTests {
    private let sara = ChatPerson(username: "sara.ghazal", displayName: "سارا", avatar: nil, online: nil)

    private func message(kind: ChatMessage.Kind = .game, fromMe: Bool = false, payload: String) throws -> ChatMessage {
        try MessageJSON.decoded(MessageJSON.message(id: "m1", kind: kind.rawValue, fromMe: fromMe, payload: payload))
    }

    private func card(_ message: ChatMessage, game: FriendGame? = nil, myID: String? = "u1") -> ChatGameLine? {
        ChatGameLine.make(message: message, other: sara, game: game, me: "niloofar", myID: myID)
    }

    private func game(_ json: String) throws -> FriendGame { try GameJSON.decoded(json) }

    @Test func anInvitationToAGameYouCanJoinHasBozanBarim() throws {
        let invite = try message(payload: #"{"event":"game_invite","gameId":"g1","kind":"mosh","code":"M4R9"}"#)
        let waiting = try game(GameJSON.game(status: "waiting", players: [GameJSON.player("sara.ghazal", name: "سارا", seat: 0)], turn: nil))
        let expected = ChatGameLine.invite(text: "سارا دعوتت کرد به مشاعره", button: ChatGameLine.Button(title: "بزن بریم", action: .join(gameID: "g1")))
        #expect(card(invite) == expected)
        #expect(card(invite, game: waiting) == expected)  // while it waits for the second player
    }

    @Test func anInvitationOfMineOpensTheGame() throws {
        let invite = try message(fromMe: true, payload: #"{"event":"game_invite","gameId":"g1","kind":"duel","code":"M4R9"}"#)
        #expect(card(invite) == .invite(text: "دعوتش کردی به بازی رودررو", button: ChatGameLine.Button(title: "ببین", action: .open(gameID: "g1"))))
    }

    @Test func aMoshGameThatStartedIsTheCardOfTheBoard() throws {
        let invite = try message(payload: #"{"event":"game_invite","gameId":"g1","kind":"mosh","code":"M4R9"}"#)
        let active = try game(GameJSON.game(moves: [GameJSON.sara]))
        guard case .mosh(let state, let id)? = card(invite, game: active) else { Issue.record("not the mosh card"); return }
        #expect(id == "g1" && state.isMyTurn && state.requiredLetter == "د" && state.turnLine == "نوبت توئه، با حرف «د»")
        #expect(state.roundLine == "دور ۲ · تا فردا")
    }

    @Test func aFinishedMoshGameKeepsItsCardWithTheResult() throws {
        let invite = try message(payload: #"{"event":"game_invite","gameId":"g1","kind":"mosh","code":"M4R9"}"#)
        let done = try game(GameJSON.game(status: "done", winner: "niloofar", reason: "resigned", turn: nil, moves: [GameJSON.sara]))
        guard case .mosh(let state, _)? = card(invite, game: done) else { Issue.record("not the mosh card"); return }
        #expect(state.isDone && state.outcomeTitle == "بردی!" && state.endLine == "سارا کم آورد")
        let duel = try message(payload: #"{"event":"game_invite","gameId":"d1","kind":"duel","code":"D4EL"}"#)
        let duelDone = try game(GameJSON.game(id: "d1", kind: "duel", turnSeconds: 8, status: "done", winner: "sara.ghazal", reason: "finished", turn: nil))
        #expect(card(duel, game: duelDone) == .invite(text: "بازی رودررو با سارا · سارا برد", button: nil))
    }

    @Test func aDuelThatIsOnCanBeOpenedAgain() throws {
        let invite = try message(payload: #"{"event":"game_invite","gameId":"d1","kind":"duel","code":"D4EL"}"#)
        let active = try game(GameJSON.game(id: "d1", kind: "duel", turnSeconds: 8, turn: nil))
        #expect(card(invite, game: active) == .invite(text: "بازی رودررو با سارا · الان در جریانه", button: ChatGameLine.Button(title: "بزن بریم", action: .open(gameID: "d1"))))
    }

    @Test func theResultOfAChallengeIsALine() throws {
        let result = try message(payload: #"{"event":"challenge_result","code":"7KQ2","game":"jigsaw","score":7,"seconds":90}"#)
        #expect(card(result) == .line("سارا توی چالشت ۷ از ۱۰ گرفت"))
        let mine = try message(fromMe: true, payload: #"{"event":"challenge_result","code":"7KQ2","game":"poet","score":9,"seconds":50}"#)
        #expect(card(mine) == .line("توی چالش سارا ۹ از ۱۰ گرفتی"))
    }

    @Test func aGameThatEndedIsALineWithWhoWon() throws {
        func ended(by: String?) throws -> ChatMessage {
            let winner = by.map { #","by":"\#($0)""# } ?? ""
            return try message(kind: .system, payload: #"{"event":"game_ended","gameId":"g1","kind":"mosh","reason":"timeout"\#(winner)}"#)
        }
        #expect(card(try ended(by: "u1")) == .line("مشاعره با سارا تموم شد · بردی!"))
        #expect(card(try ended(by: "u2")) == .line("مشاعره با سارا تموم شد · سارا برد"))
        #expect(card(try ended(by: nil)) == .line("مشاعره با سارا تموم شد · مساوی"))
    }

    @Test func otherMessagesAreNotGameLines() throws {
        let text = try MessageJSON.decoded(MessageJSON.message(id: "m1", text: "سلام"))
        #expect(card(text) == nil)
        #expect(card(try message(payload: #"{"event":"something_new"}"#)) == nil)
    }

    @Test func thePayloadOfAGameMessageIsDecoded() throws {
        let invite = try message(payload: #"{"event":"game_invite","gameId":"g1","kind":"mosh","code":"M4R9"}"#)
        #expect(invite.payload?.gameId == "g1" && invite.payload?.code == "M4R9" && invite.payload?.kind == "mosh")
        let result = try message(payload: #"{"event":"challenge_result","code":"7KQ2","game":"jigsaw","score":7,"seconds":90}"#)
        #expect(result.payload?.score == 7 && result.payload?.seconds == 90 && result.payload?.game == "jigsaw")
    }

    @Test func theLastLetterOfACoupletIsFoundWithItsMarks() {
        let text = "رقم مهر تو بر چهره‌ی ما پیدا بُود"
        let range = MoshLetters.lastLetterRange(in: text)
        #expect(range.map { String(text[$0]) } == "د")
        #expect(MoshLetters.lastLetterRange(in: "۱۲ …") == nil)
        let trailing = "پیدا بود…"
        #expect(MoshLetters.lastLetterRange(in: trailing).map { String(trailing[$0]) } == "د")
    }
}

/// The link of a challenge in a message.
struct ChallengeLinkTests {
    @Test func theCodeIsFoundInTheLineOfTheChat() {
        #expect(ChallengeLink.code(in: "نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2") == "7KQ2")
        #expect(ChallengeLink.code(in: "https://yebeyt.com/c/7kq2 ببین") == "7kq2")
        #expect(ChallengeLink.code(in: "https://www.yebeyt.com/c/AB12") == "AB12")
    }

    @Test func aTextWithoutAChallengeLinkHasNoCode() {
        #expect(ChallengeLink.code(in: "سلام") == nil)
        #expect(ChallengeLink.code(in: "yebeyt.com/i/sara") == nil)  // an invite link is another thing
        #expect(ChallengeLink.code(in: "yebeyt.com/c/7KQ2X") == nil)  // five characters are not a code
        #expect(ChallengeLink.code(in: "other.com/c/7KQ2") == nil)
    }

    @Test func aTappedUrlGivesItsCode() {
        #expect(ChallengeLink.code(of: URL(string: "https://yebeyt.com/c/7KQ2")!) == "7KQ2")
        #expect(ChallengeLink.code(of: URL(string: "https://example.com")!) == nil)
    }

    @Test func theLinkInATextIsMadeALink() {
        let text = "چالش · yebeyt.com/c/7KQ2"
        let linked = ChallengeLink.linked(text, color: .black)
        let links = linked.runs.compactMap(\.link)
        #expect(links == [URL(string: "https://yebeyt.com/c/7KQ2")!])
        #expect(String(linked.characters) == text)
        #expect(ChallengeLink.linked("سلام", color: .black).runs.compactMap(\.link).isEmpty)
    }
}
