#if DEBUG
import Foundation

/// What `-beytSignedIn` answers for messages and shared divans: five friends (sara, arian, kian, mahsa, bardia),
/// their chats as on the boards, one shared divan with Sara (24 couplets, 13 hers and 11 mine) and one with Kian.
/// Sending echoes the message back; likes flip. People (the same ones, with the same faces), friends, friend requests, search, profiles and reports are the friends stub's (`DebugFriendsBackend`; the unread answer counts its requests). Times are today and the
/// days before, so the chats look as on the boards on any day.
enum MessagesStub {
    private struct Person {
        let username: String
        let name: String
        let skin: String
        let hair: String
        let background: String
        /// `online` as JSON: true, false or null (hidden).
        let online: String
    }

    /// The same people (and faces) as the friends stub, so one Sara is everywhere.
    private static let people = [
        Person(username: "sara.ghazal", name: "سارا", skin: "peach", hair: "dark", background: "rose", online: "true"),
        Person(username: "aryan", name: "آرین", skin: "sand", hair: "black", background: "mint", online: "null"),
        Person(username: "kian_k", name: "کیان", skin: "sand", hair: "fire", background: "sun", online: "null"),
        Person(username: "mahsa.m", name: "مهسا", skin: "tan", hair: "black", background: "lapis", online: "false"),
        Person(username: "bardia", name: "بردیا", skin: "peach", hair: "amber", background: "sun", online: "null"),
    ]

    static func person(_ username: String) -> (name: String, json: String) {
        let known = people.first { $0.username == username }
        let name = known?.name ?? username
        let avatar = known.map {
            #"{"face":"\#($0.skin)","eyes":"round","hair":"\#($0.hair)","mouth":"smile","accessory":"none","background":"\#($0.background)"}"#
        } ?? "null"
        return (name, #"{"username":"\#(username)","displayName":"\#(name)","avatar":\#(avatar),"online":\#(known?.online ?? "null")}"#)
    }

    static func conversation(_ username: String) -> Conversation {
        let json = #"{"id":"c-\#(username)","other":\#(person(username).json)}"#
        // The stub's own JSON is always valid.
        return (try? JSONDecoder().decode(Conversation.self, from: Data(json.utf8))) ?? Conversation(id: "c-\(username)", other: ChatPerson(username: username, displayName: nil, avatar: nil, online: nil))
    }

    // MARK: Times

    /// «2026-11-24T09:40:00.000Z» for `daysAgo` days before today at that local time.
    private static func at(_ daysAgo: Int, _ hour: Int, _ minute: Int) -> String {
        let calendar = Calendar.current
        let day = calendar.date(byAdding: .day, value: -daysAgo, to: .now) ?? .now
        let date = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
        return DivanTime.string(DivanTime.milliseconds(of: date))
    }

    private static var now: String { DivanTime.string(DivanTime.milliseconds(of: .now)) }

    // MARK: The lists

    private static func message(
        _ id: String, _ conversation: String, kind: String = "text", mine: Bool = false, text: String? = nil, key: String? = nil, note: String? = nil,
        payload: String = "null", at: String
    ) -> String {
        func string(_ value: String?) -> String { value.map { "\"\($0)\"" } ?? "null" }
        return #"{"id":"\#(id)","conversationId":"\#(conversation)","kind":"\#(kind)","fromMe":\#(mine),"text":\#(string(text)),"key":\#(string(key)),"note":\#(string(note)),"payload":\#(payload),"deleted":false,"createdAt":"\#(at)"}"#
    }

    private static func row(_ username: String, kind: String, text: String?, mine: Bool = false, unread: Int, at: String) -> String {
        let event = kind == "game" ? "\"game_invite\"" : "null"
        let key = kind == "couplet" ? "\"/hafez/ghazal/sh8#4\"" : "null"
        let body = text.map { "\"\($0)\"" } ?? "null"
        return #"{"id":"c-\#(username)","other":\#(person(username).json),"last":{"kind":"\#(kind)","text":\#(body),"key":\#(key),"note":null,"deleted":false,"at":"\#(at)","fromMe":\#(mine),"event":\#(event)},"unread":\#(unread)}"#
    }

    private static var conversations: String {
        let rows = [
            row("sara.ghazal", kind: "game", text: nil, unread: 1, at: at(0, 9, 45)),
            row("aryan", kind: "game", text: nil, unread: 1, at: at(0, 9, 10)),
            row("kian_k", kind: "text", text: "بیت قشنگی بود", unread: 0, at: at(1, 21, 5)),
            row("mahsa.m", kind: "text", text: "فردا معما رو با هم حل کنیم؟", mine: true, unread: 0, at: at(1, 18, 30)),
            row("bardia", kind: "couplet", text: nil, unread: 0, at: at(3, 12, 0)),
        ]
        return #"{"items":[\#(rows.joined(separator: ","))],"nextCursor":null}"#
    }

    /// Newest first, as the server sends them.
    private static func messages(of conversation: String) -> String {
        let chat: [String]
        var otherRead = "null"
        switch conversation {
        case "c-sara.ghazal":
            chat = [
                message("g1", conversation, kind: "game", payload: #"{"event":"game_invite","kind":"mosh","gameId":"g1","code":"ABCD"}"#, at: at(0, 9, 45)),
                message("m3", conversation, mine: true, text: "وای چقدر قشنگه! ممنون", at: at(0, 9, 42)),
                message("m1", conversation, kind: "couplet", key: "/hafez/ghazal/sh8#4", note: "اینو دیدم یاد تو افتادم", at: at(0, 9, 40)),
            ]
            otherRead = "\"m3\""
        case "c-kian_k":
            chat = [
                message("k3", conversation, text: "بیت قشنگی بود", at: at(1, 21, 5)),
                message("k2", conversation, kind: "system", payload: #"{"event":"divan_add","key":"/khayyam/robaee/sh2#0"}"#, at: at(1, 21, 4)),
                message("k1", conversation, mine: true, text: "این رباعی رو ببین", at: at(1, 21, 0)),
            ]
        case "c-mahsa.m":
            chat = [
                message("h2", conversation, mine: true, text: "فردا معما رو با هم حل کنیم؟", at: at(1, 18, 30)),
                message("h1", conversation, text: "مهسا تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2", at: at(1, 18, 0)),
            ]
        default:
            chat = [message("x1", conversation, text: "سلام", at: at(0, 9, 10))]
        }
        return #"{"items":[\#(chat.joined(separator: ","))],"nextBefore":null,"otherReadMessageId":\#(otherRead)}"#
    }

    static var liveMessageFrame: String {
        #"{"type":"message","message":\#(message("live1", "c-sara.ghazal", text: "یه پیام زنده از سارا", at: now))}"#
    }

    // MARK: Shared divans

    private static let counts = #"{"total":24,"mine":11,"theirs":13}"#

    private static func divan(_ username: String) -> String {
        let named = person(username)
        return #"{"id":"d-\#(username)","other":\#(named.json),"counts":\#(username == "sara.ghazal" ? counts : #"{"total":3,"mine":1,"theirs":2}"#)}"#
    }

    private static func item(_ id: String, _ key: String, mine: Bool, note: String? = nil, likedByMe: Bool = false, likedByThem: Bool = false, at: String) -> String {
        let text = note.map { "\"\($0)\"" } ?? "null"
        return #"{"id":"\#(id)","key":"\#(key)","note":\#(text),"addedByMe":\#(mine),"createdAt":"\#(at)","likedByMe":\#(likedByMe),"likedByThem":\#(likedByThem)}"#
    }

    private static func divanItems(by: String) -> String {
        let hers = item("i1", "/hafez/ghazal/sh8#4", mine: false, note: "یاد سفر شیراز افتادم", likedByMe: true, at: at(1, 20, 0))
        let mine = item("i2", "/khayyam/robaee/sh2#0", mine: true, likedByThem: true, at: at(3, 20, 0))
        let older = item("i3", "/babataher/2beytiha/sh1#0", mine: false, at: at(8, 20, 0))
        let shown = by == "me" ? [mine] : by == "them" ? [hers, older] : [hers, mine, older]
        return #"{"items":[\#(shown.joined(separator: ","))],"nextCursor":null,"counts":\#(counts)}"#
    }

    // MARK: Answering

    /// nil for a request that is not about messages.
    static func answer(method: String, path: String, query: String, body: Data) -> (Int, String)? {
        let json = (try? JSONSerialization.jsonObject(with: body) as? [String: Any]) ?? [:]
        let parts = path.split(separator: "/").map(String.init)  // v1, conversations, c-sara.ghazal, messages
        switch (method, path) {
        case ("GET", "/v1/me/unread"): return (200, #"{"total":2,"friendRequests":\#(DebugFriendsBackend.incomingCount)}"#)
        case ("GET", "/v1/conversations"): return (200, conversations)
        case ("POST", "/v1/conversations"):
            let username = json["username"] as? String ?? "sara.ghazal"
            return (200, #"{"id":"c-\#(username)","other":\#(person(username).json)}"#)
        case ("GET", "/v1/shared-divans"): return (200, #"{"items":[\#(divan("sara.ghazal")),\#(divan("kian_k"))],"nextCursor":null}"#)
        case ("POST", "/v1/shared-divans"): return (200, divan(json["username"] as? String ?? "sara.ghazal"))
        default: break
        }
        if parts.count == 4, parts[1] == "conversations", parts[3] == "messages" {
            if method == "GET" { return (200, query.contains("before=") ? #"{"items":[],"nextBefore":null,"otherReadMessageId":null}"# : messages(of: parts[2])) }
            let id = "sent-\(json["clientId"] as? String ?? UUID().uuidString)"
            let isCouplet = json["kind"] as? String == "couplet"
            return (201, message(id, parts[2], kind: isCouplet ? "couplet" : "text", mine: true, text: json["text"] as? String, key: json["key"] as? String, note: json["note"] as? String, at: now))
        }
        if method == "PUT", parts.count == 4, parts[1] == "conversations", parts[3] == "read" { return (204, "") }
        if method == "DELETE", parts.count == 3, parts[1] == "messages" { return (204, "") }
        if parts.count >= 4, parts[1] == "shared-divans" {
            switch (method, parts.count) {
            case ("GET", 4): return (200, divanItems(by: query.contains("by=me") ? "me" : query.contains("by=them") ? "them" : "all"))
            case ("POST", 4):
                let key = json["key"] as? String ?? "/hafez/ghazal/sh8#4"
                return (201, item("new-\(UUID().uuidString.prefix(6))", key, mine: true, note: json["note"] as? String, at: now))
            case ("PUT", 6), ("DELETE", 6):
                let known = ["i1": ("/hafez/ghazal/sh8#4", false), "i2": ("/khayyam/robaee/sh2#0", true), "i3": ("/babataher/2beytiha/sh1#0", false)][parts[4]]
                return (200, item(parts[4], known?.0 ?? "/hafez/ghazal/sh8#4", mine: parts[4] == "i2", likedByMe: method == "PUT", likedByThem: known?.1 ?? false, at: at(1, 20, 0)))
            default: break
            }
        }
        return nil
    }
}

extension DebugBackend {
    /// The answer for a messages request, nil when the request is about something else.
    static func messagesAnswer(_ request: URLRequest) -> (Int, String)? {
        MessagesStub.answer(method: request.httpMethod ?? "GET", path: request.url?.path ?? "", query: request.url?.query ?? "", body: bodyOf(request))
    }

    /// The body of a request, also when it comes as a stream.
    static func bodyOf(_ request: URLRequest) -> Data {
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                body.append(buffer, count: count)
            }
        }
        return body
    }
}
#endif
