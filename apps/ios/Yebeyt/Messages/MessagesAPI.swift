import Foundation

/// The endpoints of messages and shared divans. Every call needs an access token (`Session.authorized`).
extension API {
    func conversations(cursor: String?, token: String) async throws -> ConversationPage {
        try await call("GET", "/v1/conversations", query: Self.items(("cursor", cursor)), token: token)
    }

    /// The chat with someone, made if there is none. 403 `messages_closed` when they don't take messages from me.
    func openConversation(username: String, token: String) async throws -> Conversation {
        try await call("POST", "/v1/conversations", body: ["username": username], token: token)
    }

    func unreadTotal(token: String) async throws -> Int {
        struct Unread: Decodable { var total: Int }
        let answer: Unread = try await call("GET", "/v1/me/unread", token: token)
        return answer.total
    }

    func messages(conversation: String, before: String?, token: String) async throws -> MessagePage {
        try await call("GET", "/v1/conversations/\(conversation)/messages", query: Self.items(("before", before)), token: token)
    }

    /// The message that was made (200 for a `clientId` already sent, 201 for a new one).
    func sendMessage(_ message: OutgoingMessage, conversation: String, token: String) async throws -> ChatMessage {
        try await call("POST", "/v1/conversations/\(conversation)/messages", body: message, token: token)
    }

    func markRead(conversation: String, messageId: String, token: String) async throws {
        try await send("PUT", "/v1/conversations/\(conversation)/read", body: ["messageId": messageId], token: token)
    }

    func deleteMessage(id: String, token: String) async throws {
        try await send("DELETE", "/v1/messages/\(id)", token: token)
    }

    func reportPerson(username: String, messageId: String?, reason: ReportReason, token: String) async throws {
        struct Body: Encodable { var username: String; var messageId: String?; var reason: String }
        try await send("POST", "/v1/reports", body: Body(username: username, messageId: messageId, reason: reason.rawValue), token: token)
    }

    /// The person's league tier this week (0 to 4), when the server tells it; the chat header says «لیگ <tier>».
    func leagueTier(username: String, token: String) async throws -> Int? {
        struct League: Decodable { var tier: Int }
        struct Profile: Decodable { var league: League? }
        let profile: Profile = try await call("GET", "/v1/users/\(username)", token: token)
        return profile.league?.tier
    }

    // MARK: Shared divans

    func sharedDivans(cursor: String?, token: String) async throws -> SharedDivanPage {
        try await call("GET", "/v1/shared-divans", query: Self.items(("cursor", cursor)), token: token)
    }

    /// The divan shared with a friend, made if there is none. 403 `forbidden` when we are not friends.
    func openSharedDivan(username: String, token: String) async throws -> SharedDivan {
        try await call("POST", "/v1/shared-divans", body: ["username": username], token: token)
    }

    func sharedDivanItems(id: String, by: SharedDivanAuthor, cursor: String?, token: String) async throws -> SharedDivanItemPage {
        try await call("GET", "/v1/shared-divans/\(id)/items", query: Self.items(("by", by.rawValue), ("cursor", cursor)), token: token)
    }

    func addSharedDivanItem(id: String, key: String, note: String?, token: String) async throws -> SharedDivanItem {
        struct Body: Encodable { var key: String; var note: String? }
        return try await call("POST", "/v1/shared-divans/\(id)/items", body: Body(key: key, note: note), token: token)
    }

    func setSharedDivanLike(id: String, item: String, liked: Bool, token: String) async throws -> SharedDivanItem {
        try await call(liked ? "PUT" : "DELETE", "/v1/shared-divans/\(id)/items/\(item)/like", token: token)
    }

    private static func items(_ pairs: (String, String?)...) -> [URLQueryItem] {
        pairs.compactMap { name, value in value.map { URLQueryItem(name: name, value: $0) } }
    }
}
