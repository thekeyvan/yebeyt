import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct MessagesWiringTests {
    @Test func openingAChatSwitchesToTheMessagesTabAndHidesTheTabBar() {
        let model = AppModel(tab: .explore)
        model.openReader(ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 0))
        model.showChat("c1")
        #expect(model.selectedTab == .messages)
        #expect(model.messagesPath == [.chat("c1")])
        #expect(model.reader == nil)
        #expect(!model.showsTabBar)  // as on the board
        #expect(model.currentScreen == .chat)
        model.messagesPath.append(.sharedDivan("sara"))
        #expect(model.currentScreen == .sharedDivan)
        model.select(.messages)  // the tab again goes back to the inbox
        #expect(model.messagesPath.isEmpty)
        #expect(model.showsTabBar)
        #expect(model.currentScreen == .messages)
    }

    @Test func theBadgeShowsTheUnreadCountInPersianDigits() {
        let model = AppModel()
        let center = MessagesCenter(session: signedInSession(StubServer().api))
        center.onUnread = { model.unreadCount = $0 }
        center.handle(.message(try! MessageJSON.decoded(MessageJSON.message(id: "m1", text: "سلام"))))
        center.handle(.message(try! MessageJSON.decoded(MessageJSON.message(id: "m2", text: "سلام"))))
        #expect(model.unreadBadgeText == "۲")
        #expect(model.unreadAccessibilityLabel == "۲ پیام نخونده")
    }

    @Test func theCenterShowsAChatThroughTheAppModel() async {
        let stub = StubServer { _ in .json(200, #"{"id":"c7","other":\#(MessageJSON.person)}"#) }
        let model = AppModel()
        let center = MessagesCenter(session: signedInSession(stub.api))
        center.show = { model.showChat($0) }
        #expect(await center.openChat(username: "sara") == nil)
        #expect(model.selectedTab == .messages)
        #expect(model.messagesPath == [.chat("c7")])
    }

    @Test func aHeldCoupletInAChatCarriesThePersonForTheSharedDivan() {
        let resolved = ResolvedCouplet(
            key: "/hafez/ghazal/sh8#4", path: "/hafez/ghazal/sh8", index: 4, couplet: Couplet(m1: "الف", m2: "ب"), poetSlug: "hafez", poetName: "حافظ", title: "غزل ۸"
        )
        var held = resolved.held
        #expect(held.sharedWith == nil)
        #expect(held.id == "/hafez/ghazal/sh8#4")
        #expect(held.caption == "حافظ · غزل ۸ · بیت ۵")
        held.sharedWith = ChatPerson(username: "sara", displayName: "سارا", avatar: nil, online: nil)
        #expect(SharedDivanTarget(key: held.id, person: held.sharedWith).person?.username == "sara")
    }

    @Test func aCoupletIsFoundByItsKeyInTheBundledBooks() async throws {
        let resolver = CoupletResolver(store: try PoetryStore(bundle: Fixtures.appBundle))
        let found = try #require(await resolver.resolve("/hafez/ghazal/sh3#0"))
        #expect(found.poetSlug == "hafez")
        #expect(found.title == "غزل ۳")
        #expect(found.couplet.m1.hasPrefix("اگر آن"))
        #expect(await resolver.resolve("/hafez/ghazal/sh3#999") == nil)
        #expect(await resolver.resolve("nonsense") == nil)
    }

    // MARK: The debug launch

    #if DEBUG
    @Test func theDebugRoutesAreParsed() {
        func route(_ text: String) -> MessagesLaunchOptions.Route? { MessagesLaunchOptions(["beytRoute": text]).route }
        #expect(route("inbox") == .inbox)
        #expect(route("chat:sara") == .chat("sara"))
        #expect(route("shared:kian") == .shared("kian"))
        #expect(route("chat:") == nil)
        #expect(route("poem:/hafez/ghazal/sh3") == nil)
        #expect(MessagesLaunchOptions(["beytLive": "1"]).live)
        #expect(!MessagesLaunchOptions([:]).live)
        #expect(MessagesLaunchOptions(["beytSignedIn": "1"]).stubbed)
        #expect(!MessagesLaunchOptions([:]).stubbed)
    }

    @Test func aDebugRouteOpensTheTabWithTheScreen() {
        let center = MessagesCenter(session: signedInSession(StubServer().api))
        let chat = AppModel()
        MessagesLaunchOptions(["beytRoute": "chat:sara"]).prepare(center: center, app: chat)
        #expect(chat.selectedTab == .messages)
        #expect(chat.messagesPath == [.chat("c-sara")])
        #expect(center.chat(id: "c-sara")?.other.name == "سارا")
        let shared = AppModel()
        MessagesLaunchOptions(["beytRoute": "shared:sara"]).prepare(center: center, app: shared)
        #expect(shared.messagesPath == [.sharedDivan("sara")])
        let inbox = AppModel()
        MessagesLaunchOptions(["beytRoute": "inbox"]).prepare(center: center, app: inbox)
        #expect(inbox.selectedTab == .messages && inbox.messagesPath.isEmpty)
    }

    /// The stub the screenshots and UI tests rely on must be what the app decodes.
    @Test func theDebugStubSpeaksTheContract() throws {
        func answer(_ method: String, _ path: String, query: String = "", body: String = "") throws -> String {
            let (status, text) = try #require(MessagesStub.answer(method: method, path: path, query: query, body: Data(body.utf8)))
            #expect((200..<300).contains(status))
            return text
        }
        func decode<T: Decodable>(_ type: T.Type, _ text: String) throws -> T { try JSONDecoder().decode(type, from: Data(text.utf8)) }
        let rows = try decode(ConversationPage.self, answer("GET", "/v1/conversations")).items
        #expect(rows.map(\.other.username) == ["sara", "arian", "kian", "mahsa", "bardia"])
        #expect(rows.map(\.unread).reduce(0, +) == 2)
        #expect(try decode(Conversation.self, answer("POST", "/v1/conversations", body: #"{"username":"sara"}"#)).id == "c-sara")
        let sara = try decode(MessagePage.self, answer("GET", "/v1/conversations/c-sara/messages"))
        #expect(sara.items.map(\.kind) == [.game, .text, .couplet])
        #expect(sara.otherReadMessageId == "m3")
        let kian = try decode(MessagePage.self, answer("GET", "/v1/conversations/c-kian/messages"))
        #expect(kian.items.contains { $0.payload?.event == "divan_add" })
        let sent = try decode(ChatMessage.self, answer("POST", "/v1/conversations/c-sara/messages", body: #"{"clientId":"k1","kind":"text","text":"سلام"}"#))
        #expect(sent.fromMe && sent.text == "سلام")
        let divans = try decode(SharedDivanPage.self, answer("GET", "/v1/shared-divans"))
        #expect(divans.items.map(\.id) == ["d-sara", "d-kian"])
        let all = try decode(SharedDivanItemPage.self, answer("GET", "/v1/shared-divans/d-sara/items"))
        #expect(all.items.count == 3 && all.counts == SharedDivanCounts(total: 24, mine: 11, theirs: 13))
        #expect(try decode(SharedDivanItemPage.self, answer("GET", "/v1/shared-divans/d-sara/items", query: "by=me")).items.map(\.id) == ["i2"])
        #expect(try decode(SharedDivanItemPage.self, answer("GET", "/v1/shared-divans/d-sara/items", query: "by=them")).items.map(\.id) == ["i1", "i3"])
        #expect(try decode(SharedDivanItem.self, answer("PUT", "/v1/shared-divans/d-sara/items/i3/like")).likedByMe)
        #expect(try answer("GET", "/v1/me/unread") == #"{"total":2}"#)
        #expect(MessagesStub.answer(method: "GET", path: "/v1/something/else", query: "", body: Data()) == nil)
    }
    #endif
}
