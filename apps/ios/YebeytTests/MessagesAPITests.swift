import Foundation
import Testing
@testable import Yebeyt

struct MessagesAPITests {
    @Test func messagesAreDecodedFromTheContract() throws {
        let page = MessageJSON.page([
            MessageJSON.message(id: "m3", kind: "couplet", fromMe: false, key: "/hafez/ghazal/sh3#0", note: "اینو دیدم", at: "2026-11-24T09:40:00.123Z"),
            MessageJSON.message(id: "m2", kind: "game", payload: #"{"event":"game_invite","gameId":"g","kind":"duel","code":"AB12"}"#),
            MessageJSON.message(id: "m1", kind: "system", payload: #"{"event":"divan_add","key":"/saadi/golestan/sh1#2"}"#),
            MessageJSON.message(id: "m0", deleted: true),
            MessageJSON.message(id: "mx", kind: "poll"),  // a kind from the future
        ], before: "m0", otherRead: "m1")
        let decoded = try JSONDecoder().decode(MessagePage.self, from: Data(page.utf8))
        #expect(decoded.nextBefore == "m0")
        #expect(decoded.otherReadMessageId == "m1")
        #expect(decoded.items[0].kind == .couplet && decoded.items[0].key == "/hafez/ghazal/sh3#0" && decoded.items[0].note == "اینو دیدم")
        #expect(decoded.items[0].countsAsUnread)
        #expect(decoded.items[1].payload?.kind == "duel" && !decoded.items[1].countsAsUnread)
        #expect(decoded.items[2].payload?.event == "divan_add" && decoded.items[2].payload?.key == "/saadi/golestan/sh1#2")
        #expect(decoded.items[3].deleted && !decoded.items[3].countsAsUnread)
        #expect(decoded.items[4].kind == .system)
        #expect(DivanTime.milliseconds(of: decoded.items[0].createdAt) % 1000 == 123)
    }

    @Test func aConversationRowKeepsThePreviewParts() throws {
        let json = """
        {"items":[{"id":"c1","other":{"username":"sara","displayName":"سارا","avatar":{"face":"peach","eyes":"round","hair":"dark","mouth":"smile","accessory":"ney","background":"sun"},"online":null},\
        "last":{"kind":"couplet","text":null,"key":"/hafez/ghazal/sh3#0","note":null,"deleted":false,"at":"2026-11-24T09:45:00.000Z","fromMe":true},"unread":2}],"nextCursor":"abc"}
        """
        let page = try JSONDecoder().decode(ConversationPage.self, from: Data(json.utf8))
        #expect(page.nextCursor == "abc")
        let row = page.items[0]
        #expect(row.other.name == "سارا" && row.other.online == nil && row.other.avatar?.face == "peach")
        #expect(row.last.kind == .couplet && row.last.key == "/hafez/ghazal/sh3#0" && row.last.fromMe)
        #expect(row.unread == 2)
    }

    @Test func requestsFollowTheContract() async throws {
        let stub = StubServer { request in
            switch (request.method, request.path) {
            case ("GET", "/v1/conversations"): .json(200, #"{"items":[],"nextCursor":null}"#)
            case ("POST", "/v1/conversations"): .json(200, #"{"id":"c1","other":\#(MessageJSON.person)}"#)
            case ("GET", "/v1/me/unread"): .json(200, #"{"total":3}"#)
            case ("GET", "/v1/conversations/c1/messages"): .json(200, MessageJSON.page([]))
            case ("POST", "/v1/conversations/c1/messages"): .json(201, MessageJSON.message(id: "m1", fromMe: true, text: "x"))
            case ("PUT", "/v1/conversations/c1/read"), ("DELETE", "/v1/messages/m1"), ("POST", "/v1/reports"): .json(204, "")
            case ("GET", "/v1/shared-divans"): .json(200, #"{"items":[{"id":"d1","other":{"username":"sara","displayName":"سارا","avatar":null},"counts":{"total":24,"mine":11,"theirs":13}}],"nextCursor":null}"#)
            case ("POST", "/v1/shared-divans"): .json(200, #"{"id":"d1","other":{"username":"sara","displayName":null,"avatar":null},"counts":{"total":0,"mine":0,"theirs":0}}"#)
            case ("GET", "/v1/shared-divans/d1/items"): .json(200, #"{"items":[],"nextCursor":null,"counts":{"total":24,"mine":11,"theirs":13}}"#)
            case ("POST", "/v1/shared-divans/d1/items"): .json(201, MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: true))
            case ("PUT", "/v1/shared-divans/d1/items/i1/like"), ("DELETE", "/v1/shared-divans/d1/items/i1/like"): .json(200, MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: true, likedByMe: request.method == "PUT"))
            case ("GET", "/v1/me/friends"): .json(200, #"{"items":[{"username":"sara","displayName":"سارا","avatar":null,"isFriend":true}],"nextCursor":null}"#)
            default: .json(404, "{}")
            }
        }
        let api = stub.api
        _ = try await api.conversations(cursor: "next", token: "t")
        _ = try await api.openConversation(username: "sara", token: "t")
        #expect(try await api.unreadTotal(token: "t") == 3)
        _ = try await api.messages(conversation: "c1", before: "m9", token: "t")
        _ = try await api.sendMessage(OutgoingMessage(clientId: "k", content: .couplet(key: "/hafez/ghazal/sh3#0", note: nil)), conversation: "c1", token: "t")
        try await api.markRead(conversation: "c1", messageId: "m1", token: "t")
        try await api.deleteMessage(id: "m1", token: "t")
        try await api.reportPerson(username: "sara", messageId: nil, reason: .spam, token: "t")
        let divans = try await api.sharedDivans(cursor: nil, token: "t")
        #expect(divans.items[0].counts == SharedDivanCounts(total: 24, mine: 11, theirs: 13))
        _ = try await api.openSharedDivan(username: "sara", token: "t")
        _ = try await api.sharedDivanItems(id: "d1", by: .them, cursor: "c", token: "t")
        _ = try await api.addSharedDivanItem(id: "d1", key: "/hafez/ghazal/sh3#0", note: "یاد سفر", token: "t")
        #expect(try await api.setSharedDivanLike(id: "d1", item: "i1", liked: true, token: "t").likedByMe)
        #expect(try await api.setSharedDivanLike(id: "d1", item: "i1", liked: false, token: "t").likedByMe == false)
        #expect(try await api.chatFriends(cursor: nil, token: "t").items.map(\.username) == ["sara"])

        #expect(stub.requests.allSatisfy { $0.authorization == "Bearer t" })
        #expect(stub.requests[0].query == "cursor=next")
        #expect(stub.requests[1].json["username"] as? String == "sara")
        #expect(stub.requests[3].query == "before=m9")
        let couplet = stub.requests[4].json
        #expect(couplet["clientId"] as? String == "k" && couplet["kind"] as? String == "couplet" && couplet["note"] == nil)
        #expect(stub.requests[5].json["messageId"] as? String == "m1")
        let report = stub.requests[7].json
        #expect(report["username"] as? String == "sara" && report["reason"] as? String == "spam" && report["messageId"] == nil)
        #expect(stub.requests.first { $0.method == "GET" && $0.path == "/v1/shared-divans/d1/items" }?.query.contains("by=them") == true)
        #expect(stub.requests.first { $0.method == "POST" && $0.path == "/v1/shared-divans/d1/items" }?.json["note"] as? String == "یاد سفر")
    }

    @Test func theLeagueTierComesFromTheProfileWhenThereIsOne() async throws {
        let stub = StubServer { request in
            request.path == "/v1/users/sara" ? .json(200, #"{"username":"sara","league":{"tier":3}}"#) : .json(200, #"{"username":"x","league":null}"#)
        }
        #expect(try await stub.api.leagueTier(username: "sara", token: "t") == 3)
        #expect(try await stub.api.leagueTier(username: "x", token: "t") == nil)
    }
}
