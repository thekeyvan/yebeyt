import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct ChatModelTests {
    typealias Response = StubServer.Response

    /// A chat with Sara on a stub server. The time is MessageClock.now and ids of new sends are «new-1», «new-2», …
    @MainActor final class Rig {
        let stub: StubServer
        let model: ChatModel

        init(_ handler: @escaping @Sendable (StubServer.Request) -> Response = { _ in .json(404, "{}") }) {
            stub = StubServer(handler)
            let session = signedInSession(stub.api)
            var next = 0
            model = ChatModel(
                conversation: Conversation(id: "c1", other: ChatPerson(username: "sara", displayName: "سارا", avatar: nil, online: true)),
                session: session, now: { MessageClock.now }, makeID: { next += 1; return "new-\(next)" }
            )
        }

        func sends() -> [StubServer.Request] { stub.requests.filter { $0.method == "POST" && $0.path == "/v1/conversations/c1/messages" } }
        func reads() -> [StubServer.Request] { stub.requests.filter { $0.method == "PUT" && $0.path == "/v1/conversations/c1/read" } }
    }

    static func message(_ id: String, mine: Bool = false, text: String = "سلام", at: String = "2026-11-24T09:40:00.000Z") -> String {
        MessageJSON.message(id: id, fromMe: mine, text: text, at: at)
    }

    // MARK: Paging

    @Test func theNewestPageComesFirstAndOlderOnesAreAddedAtTheTop() async {
        let newest = MessageJSON.page([Self.message("m4", at: "2026-11-24T09:04:00Z"), Self.message("m3", at: "2026-11-24T09:03:00Z")], before: "m3")
        let older = MessageJSON.page([Self.message("m2", at: "2026-11-24T09:02:00Z"), Self.message("m1", at: "2026-11-24T09:01:00Z")])
        let rig = Rig { request in
            request.query.contains("before=m3") ? .json(200, older) : .json(200, newest)
        }
        await rig.model.load()
        #expect(rig.model.phase == .loaded)
        #expect(rig.model.messages.map(\.id) == ["m3", "m4"])
        #expect(rig.model.hasOlder)
        await rig.model.loadOlder()
        #expect(rig.model.messages.map(\.id) == ["m1", "m2", "m3", "m4"])
        #expect(!rig.model.hasOlder)
        await rig.model.loadOlder()  // nothing more to ask
        #expect(rig.stub.requests.count == 2)
        // Loading the newest page again (a reconnect) doesn't double anything.
        await rig.model.load()
        #expect(rig.model.messages.map(\.id) == ["m1", "m2", "m3", "m4"])
    }

    @Test func aFailedFirstLoadShowsItsReasonAndAnEmptyChatIsLoaded() async {
        let rig = Rig { _ in .offline }
        await rig.model.load()
        #expect(rig.model.phase == .failed(APIError.network.persianMessage))
        rig.stub.respond { _ in .json(200, MessageJSON.page([])) }
        await rig.model.load()
        #expect(rig.model.phase == .loaded)
        #expect(rig.model.entries().isEmpty)
    }

    // MARK: Sending

    @Test func aTextIsInTheListAtOnceAndBecomesTheServersMessage() async throws {
        let rig = Rig { request in
            request.method == "POST" ? .json(201, MessageJSON.message(id: "m9", fromMe: true, text: "سلام سارا", at: "2026-11-24T12:00:01Z")) : .json(404, "{}")
        }
        rig.stub.delay = 0.05
        #expect(rig.model.send(text: "  سلام سارا \n"))
        #expect(rig.model.pending.count == 1)
        #expect(rig.model.pending[0].failed == false)
        let entries = rig.model.entries()
        #expect(entries.count == 2)  // «امروز» and the send on its way
        #expect(entries[0].content == .day("امروز"))
        if case .pending(let sending) = entries[1].content { #expect(sending.clientId == "new-1") } else { Issue.record("not pending") }
        await rig.model.settle()
        #expect(rig.model.pending.isEmpty)
        #expect(rig.model.messages.map(\.id) == ["m9"])
        let body = try #require(rig.sends().first).json
        #expect(body["kind"] as? String == "text")
        #expect(body["text"] as? String == "سلام سارا")
        #expect(body["clientId"] as? String == "new-1")
    }

    @Test func nothingIsSentForEmptyTextAndLongTextIsCut() async {
        let rig = Rig { _ in .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "x")) }
        #expect(!rig.model.send(text: " \n "))
        #expect(rig.model.pending.isEmpty)
        #expect(rig.model.send(text: String(repeating: "ا", count: 1500)))
        await rig.model.settle()
        #expect((rig.sends()[0].json["text"] as? String)?.count == 1000)
    }

    @Test func limitsCountUTF16UnitsLikeTheServer() async {
        let rig = Rig { _ in .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "x")) }
        rig.model.send(text: String(repeating: "😀", count: 700))  // 2 units each: 500 fit in 1000
        rig.model.sendCouplet(key: "/hafez/ghazal/sh3#0", note: String(repeating: "😀", count: 150) + "ا")
        await rig.model.settle()
        let bodies = rig.sends().map(\.json)
        let text = bodies.compactMap { $0["text"] as? String }.first ?? ""
        #expect(text.utf16.count == 1000 && text.count == 500)
        let note = bodies.compactMap { $0["note"] as? String }.first ?? ""
        #expect(note.utf16.count == 200 && note.count == 100)
        #expect("ab😀".limited(toUTF16: 3) == "ab")  // never half an emoji
    }

    @Test func eachBubbleIsReadAloudWithItsSender() throws {
        let theirs = try MessageJSON.decoded(MessageJSON.message(id: "m1", text: "سلام", at: "2026-11-24T09:40:00Z"))
        let view = TextMessageView(message: theirs, senderName: "سارا", seen: false, delete: {}, report: {})
        #expect(view.spoken.hasPrefix("سارا: سلام، "))
        let mine = try MessageJSON.decoded(MessageJSON.message(id: "m2", fromMe: true, text: "ممنون"))
        let seen = TextMessageView(message: mine, senderName: "سارا", seen: true, delete: {}, report: {})
        #expect(seen.spoken.hasPrefix("تو: ممنون، ") && seen.spoken.hasSuffix("دیده شد"))
    }

    @Test func aCoupletGoesWithItsKeyAndTheNoteOnlyWhenThereIsOne() async {
        let rig = Rig { _ in .json(201, MessageJSON.message(id: "m1", kind: "couplet", fromMe: true, key: "/hafez/ghazal/sh3#0")) }
        rig.model.sendCouplet(key: "/hafez/ghazal/sh3#0", note: "  اینو دیدم  ")
        rig.model.sendCouplet(key: "/hafez/ghazal/sh3#1", note: "   ")
        await rig.model.settle()
        let bodies = rig.sends().map(\.json)
        #expect(bodies.count == 2)
        #expect(bodies.allSatisfy { $0["kind"] as? String == "couplet" })
        #expect(bodies.compactMap { $0["note"] as? String } == ["اینو دیدم"])
        #expect(bodies.compactMap { $0["key"] as? String }.sorted() == ["/hafez/ghazal/sh3#0", "/hafez/ghazal/sh3#1"])
    }

    @Test func aFailedSendWaitsForARetryThatUsesTheSameClientId() async {
        let rig = Rig { _ in .offline }
        rig.model.send(text: "سلام")
        await rig.model.settle()
        #expect(rig.model.pending.count == 1)
        #expect(rig.model.pending[0].failed)
        #expect(rig.model.toast == nil)  // the bubble says it, not a toast
        rig.stub.respond { _ in .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "سلام")) }
        rig.model.retry("new-1")
        #expect(rig.model.pending[0].failed == false)
        rig.model.retry("new-1")  // a second tap while it is on its way does nothing
        await rig.model.settle()
        #expect(rig.model.pending.isEmpty)
        #expect(rig.model.messages.map(\.id) == ["m1"])
        #expect(rig.sends().count == 2)
        #expect(Set(rig.sends().compactMap { $0.json["clientId"] as? String }) == ["new-1"])
    }

    @Test func aFailedSendCanBeThrownAway() async {
        let rig = Rig { _ in .offline }
        rig.model.send(text: "سلام")
        await rig.model.settle()
        rig.model.discard("new-1")
        #expect(rig.model.pending.isEmpty)
        #expect(rig.model.entries().isEmpty)
    }

    @Test func theEventOfMyOwnSendDoesNotMakeASecondBubble() async throws {
        let rig = Rig { _ in .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "سلام")) }
        rig.stub.delay = 0.05
        rig.model.send(text: "سلام")
        // The live event is faster than the answer.
        rig.model.apply(.message(try MessageJSON.decoded(MessageJSON.message(id: "m1", fromMe: true, text: "سلام"))))
        #expect(rig.model.pending.isEmpty)
        #expect(rig.model.messages.count == 1)
        await rig.model.settle()
        #expect(rig.model.messages.map(\.id) == ["m1"])
        #expect(rig.model.entries().count == 2)  // the day and one bubble
    }

    @Test func aSentBubbleKeepsItsRowIDWhenTheServersMessageReplacesIt() async {
        let rig = Rig { _ in .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "سلام")) }
        rig.stub.delay = 0.05
        rig.model.send(text: "سلام")
        let sending = rig.model.entries().last
        #expect(sending?.id == "new-1")
        await rig.model.settle()
        let sent = rig.model.entries().last
        #expect(sent?.id == "m1")
        #expect(sent?.rowID == sending?.rowID)  // one row, so the list springs it in once
    }

    @Test func theLiveEventBeforeTheAnswerKeepsTheRowIDToo() throws {
        let rig = Rig { _ in .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "سلام")) }
        rig.stub.delay = 0.05
        rig.model.send(text: "سلام")
        let sending = rig.model.entries().last
        rig.model.apply(.message(try MessageJSON.decoded(MessageJSON.message(id: "m1", fromMe: true, text: "سلام"))))
        #expect(rig.model.entries().last?.rowID == sending?.rowID)
    }

    @Test func aMessageOfSomeoneElseIsKeyedByItsOwnID() throws {
        let rig = Rig()
        rig.model.apply(.message(try MessageJSON.decoded(MessageJSON.message(id: "m2", fromMe: false, text: "سلام"))))
        #expect(rig.model.entries().last?.rowID == "m2")
    }

    @Test func aSecondPhoneOfMineShowsUpAsAnOrdinaryMessage() throws {
        let rig = Rig()
        rig.model.apply(.message(try MessageJSON.decoded(MessageJSON.message(id: "m1", fromMe: true, text: "از گوشی دیگه"))))
        #expect(rig.model.messages.map(\.id) == ["m1"])
        #expect(rig.model.pending.isEmpty)
    }

    @Test func aClosedChatTakesNoMoreSends() async {
        let rig = Rig { _ in .json(403, #"{"error":"messages_closed"}"#) }
        rig.model.send(text: "سلام")
        await rig.model.settle()
        #expect(rig.model.isClosed)
        #expect(!rig.model.send(text: "دوباره"))
        #expect(rig.sends().count == 1)
        // What was typed stays in the list, refused, and cannot be sent again.
        #expect(rig.model.pending.map(\.refused) == [true])
        rig.model.retry("new-1")
        await rig.model.settle()
        #expect(rig.sends().count == 1)
    }

    @Test func tooManySendsSaySlowDownAndKeepTheMessageForARetry() async {
        let rig = Rig { _ in .json(429, #"{"error":"rate_limited"}"#) }
        rig.model.send(text: "سلام")
        await rig.model.settle()
        #expect(rig.model.toast == "یه کم آروم‌تر")
        #expect(rig.model.pending.map(\.failed) == [true])
        #expect(!rig.model.isClosed)
    }

    // MARK: Read receipts

    @Test func seenGoesUnderMyLastMessageTheOtherPersonHasRead() async {
        let page = MessageJSON.page(
            [
                Self.message("m5", mine: true, at: "2026-11-24T09:05:00Z"), Self.message("m4", mine: true, at: "2026-11-24T09:04:00Z"),
                Self.message("m3", at: "2026-11-24T09:03:00Z"), Self.message("m2", mine: true, at: "2026-11-24T09:02:00Z"),
                Self.message("m1", at: "2026-11-24T09:01:00Z"),
            ], otherRead: "m3"
        )
        let rig = Rig { _ in .json(200, page) }
        await rig.model.load()
        #expect(rig.model.seenMessageID == "m2")
        #expect(rig.model.entries().filter(\.seen).map(\.id) == ["m2"])
        rig.model.apply(.read(conversationId: "c1", username: "sara", messageId: "m5"))
        #expect(rig.model.seenMessageID == "m5")
        #expect(rig.model.entries().filter(\.seen).map(\.id) == ["m5"])
        // Someone else's read mark, or another chat's, changes nothing.
        rig.model.apply(.read(conversationId: "c2", username: "sara", messageId: "m1"))
        rig.model.apply(.read(conversationId: "c1", username: "arian", messageId: "m1"))
        #expect(rig.model.seenMessageID == "m5")
    }

    @Test func nothingIsSeenWhenTheReadMessageIsNotMineOrNotThere() async {
        let page = MessageJSON.page([Self.message("m2", at: "2026-11-24T09:02:00Z"), Self.message("m1", mine: true, at: "2026-11-24T09:01:00Z")], otherRead: nil)
        let rig = Rig { _ in .json(200, page) }
        await rig.model.load()
        #expect(rig.model.seenMessageID == nil)
        rig.model.apply(.read(conversationId: "c1", username: "sara", messageId: "unknown"))
        #expect(rig.model.seenMessageID == nil)
    }

    @Test func theNewestMessageIsMarkedReadOnceWhileTheChatIsOnScreen() async throws {
        let page = MessageJSON.page([Self.message("m2", at: "2026-11-24T09:02:00Z"), Self.message("m1", at: "2026-11-24T09:01:00Z")])
        let rig = Rig { request in request.method == "PUT" ? .json(204, "") : .json(200, page) }
        var asked = 0
        rig.model.onRead = { asked += 1 }
        await rig.model.load()
        await rig.model.settle()
        #expect(rig.reads().isEmpty)  // not on screen yet
        rig.model.isVisible = true
        await rig.model.settle()
        #expect(rig.reads().map { $0.json["messageId"] as? String } == ["m2"])
        #expect(asked == 1)
        rig.model.markRead()  // nothing new
        await rig.model.settle()
        #expect(rig.reads().count == 1)
        rig.model.apply(.message(try MessageJSON.decoded(Self.message("m3", at: "2026-11-24T09:03:00Z"))))
        await rig.model.settle()
        #expect(rig.reads().map { $0.json["messageId"] as? String } == ["m2", "m3"])
        rig.model.isVisible = false
        rig.model.apply(.message(try MessageJSON.decoded(Self.message("m4", at: "2026-11-24T09:04:00Z"))))
        await rig.model.settle()
        #expect(rig.reads().count == 2)  // away: it waits
    }

    @Test func aFailedReadMarkIsTriedAgainWithTheNextMessage() async throws {
        let page = MessageJSON.page([Self.message("m1")])
        let rig = Rig { request in request.method == "PUT" ? .offline : .json(200, page) }
        rig.model.isVisible = true
        await rig.model.load()
        await rig.model.settle()
        rig.model.markRead()
        await rig.model.settle()
        #expect(rig.reads().count == 2)
    }

    @Test func theFirstVisibleLoadAlwaysSendsTheReadMarkEvenAfterAnAnswerOfMine() async {
        let page = MessageJSON.page([Self.message("m2", mine: true, at: "2026-11-24T09:02:00Z"), Self.message("m1", at: "2026-11-24T09:01:00Z")])
        let rig = Rig { request in request.method == "PUT" ? .json(204, "") : .json(200, page) }
        rig.model.isVisible = true
        await rig.model.load()
        await rig.model.settle()
        #expect(rig.reads().map { $0.json["messageId"] as? String } == ["m2"])
    }

    @Test func aGameLineOfTheirsIsUnreadAndGetsMarkedRead() async {
        let page = MessageJSON.page([MessageJSON.message(id: "g1", kind: "game", payload: #"{"event":"game_invite","kind":"duel"}"#, at: "2026-11-24T09:02:00Z")])
        let rig = Rig { request in request.method == "PUT" ? .json(204, "") : .json(200, page) }
        rig.model.isVisible = true
        await rig.model.load()
        await rig.model.settle()
        #expect(rig.model.messages[0].countsAsUnread)
        #expect(rig.reads().map { $0.json["messageId"] as? String } == ["g1"])
    }

    // MARK: Deleting and reporting

    @Test func aDeletedEventClearsTheMessageAndKeepsItsPlace() async throws {
        let page = MessageJSON.page([Self.message("m2", at: "2026-11-24T09:02:00Z"), MessageJSON.message(id: "m1", kind: "couplet", key: "/hafez/ghazal/sh3#0", note: "یادت", at: "2026-11-24T09:01:00Z")])
        let rig = Rig { _ in .json(200, page) }
        await rig.model.load()
        rig.model.apply(.deleted(conversationId: "c1", messageId: "m1"))
        let deleted = try #require(rig.model.messages.first)
        #expect(deleted.deleted)
        #expect(deleted.key == nil && deleted.note == nil && deleted.text == nil)
        #expect(rig.model.messages.map(\.id) == ["m1", "m2"])
        rig.model.apply(.deleted(conversationId: "other", messageId: "m2"))
        #expect(rig.model.messages[1].deleted == false)
    }

    @Test func deletingMyMessageAsksTheServerThenClearsIt() async {
        let page = MessageJSON.page([Self.message("m1", mine: true)])
        let rig = Rig { request in request.method == "DELETE" ? .json(204, "") : .json(200, page) }
        await rig.model.load()
        await rig.model.delete(rig.model.messages[0])
        #expect(rig.stub.requests.contains { $0.method == "DELETE" && $0.path == "/v1/messages/m1" })
        #expect(rig.model.messages[0].deleted)
    }

    @Test func aMessageOfTheOtherPersonIsNeverDeletedFromHere() async {
        let page = MessageJSON.page([Self.message("m1")])
        let rig = Rig { _ in .json(200, page) }
        await rig.model.load()
        await rig.model.delete(rig.model.messages[0])
        #expect(!rig.stub.requests.contains { $0.method == "DELETE" })
        #expect(!rig.model.messages[0].deleted)
    }

    @Test func aDeleteThatFailsKeepsTheMessageAndSaysWhy() async {
        let page = MessageJSON.page([Self.message("m1", mine: true)])
        let rig = Rig { request in request.method == "DELETE" ? .offline : .json(200, page) }
        await rig.model.load()
        await rig.model.delete(rig.model.messages[0])
        #expect(!rig.model.messages[0].deleted)
        #expect(rig.model.toast == APIError.network.persianMessage)
    }

    @Test func aReportNamesThePersonTheMessageAndTheReason() async throws {
        let page = MessageJSON.page([Self.message("m1")])
        let rig = Rig { request in request.method == "POST" ? .json(204, "") : .json(200, page) }
        await rig.model.load()
        await rig.model.report(rig.model.messages[0], reason: .abuse)
        let body = try #require(rig.stub.requests.first { $0.path == "/v1/reports" }).json
        #expect(body["username"] as? String == "sara")
        #expect(body["messageId"] as? String == "m1")
        #expect(body["reason"] as? String == "abuse")
        #expect(rig.model.toast == "گزارشت رسید")
    }

    // MARK: The list

    @Test func daysAreLabelledInPersianAndMessagesKeepTheirOrder() async {
        let page = MessageJSON.page([
            Self.message("m5", at: "2026-11-24T11:00:00Z"), Self.message("m4", at: "2026-11-24T08:00:00Z"), Self.message("m3", at: "2026-11-23T20:00:00Z"),
            Self.message("m2", at: "2026-11-21T09:00:00Z"), Self.message("m1", at: "2026-11-10T09:00:00Z"),
        ])
        let rig = Rig { _ in .json(200, page) }
        await rig.model.load()
        let entries = rig.model.entries(now: MessageClock.now, calendar: MessageClock.calendar)
        let days = entries.compactMap { entry -> String? in if case .day(let label) = entry.content { label } else { nil } }
        #expect(days == ["۱۹ آبان", "شنبه", "دیروز", "امروز"])
        let order = entries.map { entry -> String in
            switch entry.content {
            case .day(let label): "day:\(label)"
            case .message(let message): message.id
            case .pending(let sending): sending.clientId
            }
        }
        #expect(order == ["day:۱۹ آبان", "m1", "day:شنبه", "m2", "day:دیروز", "m3", "day:امروز", "m4", "m5"])
    }

    @Test func aSendOnItsWayGetsTodaysLabelWhenTheLastMessageIsOlder() async {
        let page = MessageJSON.page([Self.message("m1", at: "2026-11-23T09:00:00Z")])
        let rig = Rig { _ in .json(200, page) }
        await rig.model.load()
        rig.stub.respond { _ in .offline }
        rig.model.send(text: "سلام")
        await rig.model.settle()
        let days = rig.model.entries(now: MessageClock.now, calendar: MessageClock.calendar).compactMap { entry -> String? in
            if case .day(let label) = entry.content { label } else { nil }
        }
        #expect(days == ["دیروز", "امروز"])
    }

    @Test func theDivanLineTheGameLinesAndTheChallengeResultAreShown() async {
        let page = MessageJSON.page([
            MessageJSON.message(id: "m4", kind: "game", payload: #"{"event":"challenge_result","code":"AB12"}"#, at: "2026-11-24T09:04:00Z"),
            MessageJSON.message(id: "m3", kind: "game", payload: #"{"event":"game_invite","kind":"mosh"}"#, at: "2026-11-24T09:03:00Z"),
            MessageJSON.message(id: "m2", kind: "system", payload: #"{"event":"game_ended","kind":"mosh"}"#, at: "2026-11-24T09:02:00Z"),
            MessageJSON.message(id: "m1", kind: "system", payload: #"{"event":"divan_add","key":"/hafez/ghazal/sh3#0"}"#, at: "2026-11-24T09:01:00Z"),
        ])
        let rig = Rig { _ in .json(200, page) }
        await rig.model.load()
        let shown = rig.model.entries(now: MessageClock.now, calendar: MessageClock.calendar).compactMap { entry -> String? in
            if case .message(let message) = entry.content { message.id } else { nil }
        }
        #expect(shown == ["m1", "m2", "m3", "m4"])
    }

    // MARK: The header

    @Test func onlineShowsOnlyWhenAllowedAndPresenceChangesIt() async throws {
        let rig = Rig { request in
            request.path == "/v1/users/sara" ? .json(200, #"{"username":"sara","league":{"tier":2}}"#) : .json(404, "{}")
        }
        #expect(rig.model.statusLine == "آنلاین")
        await rig.model.loadLeague()
        #expect(rig.model.statusLine == "آنلاین · لیگ غزل‌باز")
        rig.model.apply(.presence(username: "sara", online: false))
        #expect(rig.model.statusLine == "لیگ غزل‌باز")
        rig.model.apply(.presence(username: "arian", online: true))
        #expect(rig.model.other.online == false)
    }

    @Test func aPersonWhoHidesOnlineHasNoOnlineWord() {
        let stub = StubServer()
        let model = ChatModel(conversation: Conversation(id: "c1", other: ChatPerson(username: "sara", displayName: nil, avatar: nil, online: nil)), session: signedInSession(stub.api))
        #expect(model.statusLine == nil)
        #expect(model.other.name == "sara")
    }

    @Test func theSameToastShownAgainStartsItsTimeOver() {
        let stub = StubServer()
        let model = ChatModel(conversation: Conversation(id: "c1", other: ChatPerson(username: "sara", displayName: nil, avatar: nil, online: nil)), session: signedInSession(stub.api))
        let before = model.toastSerial
        model.toast = "نرسید"
        model.toast = "نرسید"
        #expect(model.toastSerial == before + 2)
    }
}
