import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct InboxAndCenterTests {
    nonisolated static let first = MessageJSON.rows(
        [
            MessageJSON.row(id: "c1", username: "sara", name: "سارا", text: "یه مشاعره شروع کرد", unread: 1),
            MessageJSON.row(id: "c2", username: "arian_k", name: "آرین", text: "سلام", unread: 0, at: "2026-11-23T09:10:00Z"),
        ], next: "page2"
    )
    nonisolated static let second = MessageJSON.rows([MessageJSON.row(id: "c3", username: "kian", name: "كیان", text: "بیت قشنگی بود", at: "2026-11-21T09:00:00Z")])

    func inbox(_ handler: @escaping @Sendable (StubServer.Request) -> StubServer.Response) -> (InboxModel, StubServer) {
        let stub = StubServer(handler)
        return (InboxModel(session: signedInSession(stub.api)), stub)
    }

    // MARK: Inbox

    @Test func theInboxLoadsPageByPage() async {
        let (model, stub) = inbox { request in request.query.contains("cursor=page2") ? .json(200, Self.second) : .json(200, Self.first) }
        await model.load()
        #expect(model.phase == .loaded)
        #expect(model.rows.map(\.id) == ["c1", "c2"])
        #expect(model.hasMore)
        await model.loadMore()
        #expect(model.rows.map(\.id) == ["c1", "c2", "c3"])
        #expect(!model.hasMore)
        await model.loadMore()
        #expect(stub.requests.count == 2)
        // Reading the first page again (a reconnect) keeps the older rows and doesn't double any.
        await model.load()
        #expect(model.rows.map(\.id) == ["c1", "c2", "c3"])
        #expect(!model.hasMore)
    }

    @Test func aFailedFirstLoadIsFailedAndAnEmptyInboxIsLoaded() async {
        let (model, stub) = inbox { _ in .offline }
        await model.load()
        #expect(model.phase == .failed(APIError.network.persianMessage))
        stub.respond { _ in .json(200, MessageJSON.rows([])) }
        await model.load()
        #expect(model.phase == .loaded)
        #expect(model.rows.isEmpty)
    }

    @Test func searchFiltersTheLoadedRowsByNameOrUsername() async {
        let (model, _) = inbox { _ in .json(200, Self.first.replacingOccurrences(of: #""nextCursor":"page2""#, with: #""nextCursor":null"#)) }
        await model.load()
        #expect(model.visibleRows.count == 2)
        model.query = "سار"
        #expect(model.visibleRows.map(\.id) == ["c1"])
        model.query = "arian"
        #expect(model.visibleRows.map(\.id) == ["c2"])
        model.query = "ARIAN_K"
        #expect(model.visibleRows.map(\.id) == ["c2"])
        model.query = "هیچی"
        #expect(model.visibleRows.isEmpty)
        model.query = "  "
        #expect(model.visibleRows.count == 2)
    }

    @Test func searchTreatsArabicLettersAsPersian() async {
        let (model, _) = inbox { _ in .json(200, Self.second) }
        await model.load()
        model.query = "کیان"  // the name was saved with an Arabic ك
        #expect(model.visibleRows.count == 1)
    }

    @Test func aNewMessageMovesItsRowToTheTopAndCountsUnreadUnlessItIsOpen() async throws {
        let (model, _) = inbox { _ in .json(200, Self.first) }
        await model.load()
        let message = try MessageJSON.decoded(MessageJSON.message(id: "m1", conversation: "c2", text: "جدید"))
        #expect(!model.apply(.message(message), viewing: []))
        #expect(model.rows.map(\.id) == ["c2", "c1"])
        #expect(model.rows[0].unread == 1)
        #expect(model.rows[0].last.text == "جدید")
        let again = try MessageJSON.decoded(MessageJSON.message(id: "m2", conversation: "c2", text: "باز هم"))
        model.apply(.message(again), viewing: ["c2"])
        #expect(model.rows[0].unread == 1)  // the chat is open: it is read as it comes
        let mine = try MessageJSON.decoded(MessageJSON.message(id: "m3", conversation: "c1", fromMe: true, text: "جواب"))
        model.apply(.message(mine), viewing: [])
        #expect(model.rows[0].id == "c1" && model.rows[0].unread == 1)  // my own message is not unread
        #expect(InboxModel.preview(model.rows[0].last) == "تو: جواب")
    }

    @Test func aMessageOfAnUnknownChatAsksForTheListAgain() async throws {
        let (model, _) = inbox { _ in .json(200, Self.first) }
        await model.load()
        let stranger = try MessageJSON.decoded(MessageJSON.message(id: "m1", conversation: "c9", text: "سلام"))
        #expect(model.apply(.message(stranger), viewing: []))
        #expect(model.rows.map(\.id) == ["c1", "c2"])
    }

    @Test func presenceAndReadMarksUpdateTheRows() async {
        let (model, _) = inbox { _ in .json(200, Self.first) }
        await model.load()
        model.apply(.presence(username: "sara", online: true), viewing: [])
        #expect(model.rows[0].other.online == true)
        model.markRead(conversation: "c1")
        #expect(model.rows[0].unread == 0)
    }

    @Test func thePreviewLineFollowsTheBoard() {
        let at = MessageClock.now
        func line(_ kind: ChatMessage.Kind, text: String? = nil, fromMe: Bool = false, deleted: Bool = false, event: String? = nil) -> String {
            InboxModel.preview(ConversationLast(kind: kind, text: text, key: kind == .couplet ? "/hafez/ghazal/sh3#0" : nil, deleted: deleted, at: at, fromMe: fromMe, event: event))
        }
        #expect(line(.text, text: "فردا معما رو با هم حل کنیم؟", fromMe: true) == "تو: فردا معما رو با هم حل کنیم؟")
        #expect(line(.text, text: "بیت قشنگی بود") == "بیت قشنگی بود")
        #expect(line(.couplet) == "یه بیت فرستاد")
        #expect(line(.couplet, fromMe: true) == "تو: یه بیت فرستادی")
        #expect(line(.game) == "دعوتت کرد به بازی")
        #expect(line(.system, event: "divan_add") == "یه بیت به دیوان مشترک اضافه کرد")
        #expect(line(.text, deleted: true) == "این پیام پاک شد")
    }

    @Test func aSystemLineIsReadByItsEventAndOthersShowNothing() {
        func last(_ event: String?) -> ConversationLast { ConversationLast(kind: .system, at: MessageClock.now, fromMe: false, event: event) }
        #expect(InboxModel.preview(last("divan_add")) == "یه بیت به دیوان مشترک اضافه کرد")
        #expect(InboxModel.preview(last("game_ended")) == "")
        #expect(InboxModel.preview(last(nil)) == "")  // an event this app doesn't know is not guessed
    }

    @Test func theEventOfTheLastMessageComesFromTheList() async {
        let rows = MessageJSON.rows([MessageJSON.row(id: "c1", username: "sara", kind: "system", text: nil, event: "divan_add")])
        let (model, _) = inbox { _ in .json(200, rows) }
        await model.load()
        #expect(model.rows[0].last.event == "divan_add")
        #expect(InboxModel.preview(model.rows[0].last) == "یه بیت به دیوان مشترک اضافه کرد")
    }

    @Test func aLiveSystemLineKeepsItsEventInTheRow() async throws {
        let (model, _) = inbox { _ in .json(200, Self.first) }
        await model.load()
        let line = try MessageJSON.decoded(MessageJSON.message(id: "s1", conversation: "c2", kind: "system", payload: #"{"event":"game_ended","kind":"mosh"}"#))
        model.apply(.message(line), viewing: [])
        #expect(model.rows[0].last.event == "game_ended")
        #expect(InboxModel.preview(model.rows[0].last) == "")
        #expect(model.rows[0].unread == 0)  // a system line is never unread
    }

    // MARK: The center

    func center(_ handler: @escaping @Sendable (StubServer.Request) -> StubServer.Response, sockets: any LiveSocketFactory = FakeLiveSockets()) -> (MessagesCenter, StubServer) {
        let stub = StubServer(handler)
        return (MessagesCenter(session: signedInSession(stub.api), sockets: sockets), stub)
    }

    @Test func theUnreadTotalComesFromTheServerAndGrowsWithLiveMessages() async throws {
        let (center, _) = center { request in request.path == "/v1/me/unread" ? .json(200, #"{"total":2}"#) : .json(404, "{}") }
        var badge: [Int] = []
        center.onUnread = { badge.append($0) }
        await center.refreshUnread()
        #expect(center.unread == 2)
        center.handle(.message(try MessageJSON.decoded(MessageJSON.message(id: "m1", conversation: "c1", text: "سلام"))))
        #expect(center.unread == 3)
        center.handle(.message(try MessageJSON.decoded(MessageJSON.message(id: "m2", conversation: "c1", fromMe: true, text: "جواب"))))
        center.handle(.message(try MessageJSON.decoded(MessageJSON.message(id: "m3", conversation: "c1", kind: "system", payload: #"{"event":"divan_add"}"#))))
        center.handle(.message(try MessageJSON.decoded(MessageJSON.message(id: "m4", conversation: "c1", kind: "game", payload: #"{"event":"game_invite"}"#))))
        #expect(center.unread == 4)  // a game line of theirs counts (as on the server); mine and system lines don't
        #expect(badge == [2, 3, 4])
    }

    @Test func aMessageInTheOpenChatIsReadAsItComesAndMovesTheBadgeBack() async throws {
        let (center, stub) = center { request in
            switch (request.method, request.path) {
            case ("GET", "/v1/me/unread"): .json(200, #"{"total":0}"#)
            case ("PUT", "/v1/conversations/c1/read"): .json(204, "")
            default: .json(404, "{}")
            }
        }
        let chat = center.chat(for: Conversation(id: "c1", other: ChatPerson(username: "sara", displayName: "سارا", avatar: nil, online: nil)))
        chat.isVisible = true
        center.handle(.message(try MessageJSON.decoded(MessageJSON.message(id: "m1", conversation: "c1", text: "سلام"))))
        #expect(center.unread == 0)  // the chat is open
        #expect(chat.messages.map(\.id) == ["m1"])
        await chat.settle()
        #expect(stub.requests.contains { $0.method == "PUT" && $0.json["messageId"] as? String == "m1" })
        #expect(await eventually { stub.requests.contains { $0.path == "/v1/me/unread" } })  // the total is asked again after a read
    }

    @Test func eventsReachTheChatTheInboxAndTheSharedDivan() async throws {
        let (center, _) = center { request in
            switch request.path {
            case "/v1/conversations": .json(200, Self.first)
            default: .json(404, "{}")
            }
        }
        await center.inbox.load()
        let chat = center.chat(for: center.inbox.conversation(center.inbox.rows[1]))
        center.handle(.message(try MessageJSON.decoded(MessageJSON.message(id: "m1", conversation: "c2", text: "سلام"))))
        center.handle(.presence(username: "arian_k", online: true))
        #expect(chat.messages.map(\.id) == ["m1"])
        #expect(chat.other.online == true)
        #expect(center.inbox.rows[0].id == "c2")
        #expect(center.inbox.rows[0].other.online == true)
        #expect(center.chat(id: "c2") === chat)
    }

    @Test func theSocketBringsEventsAndEveryConnectReadsTheListsAgain() async throws {
        let sockets = FakeLiveSockets()
        let (center, stub) = center({ request in request.path == "/v1/me/unread" ? .json(200, #"{"total":1}"#) : .json(200, Self.first) }, sockets: sockets)
        await center.inbox.load()
        center.inbox.isVisible = true
        center.setActive(true)
        #expect(await eventually { sockets.sockets.count == 1 })
        sockets.sockets[0].readyFrame()
        #expect(await eventually { center.unread == 1 })  // read again on connect
        let message = MessageJSON.message(id: "m1", conversation: "c1", text: "سلام")
        sockets.sockets[0].push(#"{"type":"message","message":\#(message)}"#)
        #expect(await eventually { center.unread == 2 })
        #expect(stub.requests.filter { $0.path == "/v1/conversations" }.count >= 2)
        center.setActive(false)
        #expect(sockets.sockets[0].closedByClient)
    }

    @Test func aConnectReadsOnlyWhatIsOnScreen() async {
        let sockets = FakeLiveSockets()
        let (center, stub) = center({ request in
            switch request.path {
            case "/v1/me/unread": .json(200, #"{"total":0}"#)
            case "/v1/conversations": .json(200, Self.first)
            default: .json(200, MessageJSON.page([]))
            }
        }, sockets: sockets)
        await center.inbox.load()
        let open = center.chat(for: Conversation(id: "c1", other: ChatPerson(username: "sara", displayName: nil, avatar: nil, online: nil)))
        let away = center.chat(for: Conversation(id: "c2", other: ChatPerson(username: "arian_k", displayName: nil, avatar: nil, online: nil)))
        await open.load()
        await away.load()
        open.isVisible = true
        let before = stub.requests.count
        await center.reconnected()
        let paths = stub.requests.dropFirst(before).map(\.path)
        #expect(paths.contains("/v1/me/unread"))
        #expect(paths.contains("/v1/conversations/c1/messages"))
        #expect(!paths.contains("/v1/conversations/c2/messages"))  // not on screen
        #expect(!paths.contains("/v1/conversations"))  // the inbox is not on screen either
    }

    @Test func signedOutThereIsNoSocket() {
        let sockets = FakeLiveSockets()
        let stub = StubServer()
        let center = MessagesCenter(session: Session(api: stub.api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")), sockets: sockets)
        center.setActive(true)
        #expect(sockets.sockets.isEmpty)
    }

    @Test func openingAChatByUsernameShowsItAndAClosedOneSaysWhy() async {
        let (center, stub) = center { request in
            request.method == "POST" ? .json(200, #"{"id":"c7","other":\#(MessageJSON.person)}"#) : .json(404, "{}")
        }
        var shown: [String] = []
        center.show = { shown.append($0) }
        #expect(await center.openChat(username: "sara") == nil)
        #expect(shown == ["c7"])
        #expect(center.chat(id: "c7")?.other.username == "sara")
        #expect(stub.requests[0].json["username"] as? String == "sara")
        stub.respond { _ in .json(403, #"{"error":"messages_closed"}"#) }
        #expect(await center.openChat(username: "kian") == "دیگه نمی‌تونی به این گفتگو پیام بدی")
        #expect(shown == ["c7"])
    }

    @Test func signingOutForgetsEverything() async throws {
        let (center, _) = center { request in request.path == "/v1/me/unread" ? .json(200, #"{"total":4}"#) : .json(200, Self.first) }
        await center.inbox.load()
        await center.refreshUnread()
        _ = center.chat(for: Conversation(id: "c1", other: ChatPerson(username: "sara", displayName: nil, avatar: nil, online: nil)))
        center.reset()
        #expect(center.unread == 0)
        #expect(center.inbox.rows.isEmpty)
        #expect(center.chat(id: "c1") == nil)
    }
}
