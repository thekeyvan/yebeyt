import Foundation

// The messages part of the contract (`packages/api/openapi.json`): chats, messages, shared divans.

/// `ChatPerson`: the other person of a chat. `online` is nil when they don't let others see it.
struct ChatPerson: Codable, Equatable, Sendable {
    var username: String
    var displayName: String?
    var avatar: AvatarParts?
    var online: Bool?

    /// The name shown: the display name, else the username.
    var name: String {
        guard let displayName, !displayName.trimmingCharacters(in: .whitespaces).isEmpty else { return username }
        return displayName
    }
}

/// The last message of a chat, as the inbox shows it. The server holds no poem text: a couplet comes as its key.
struct ConversationLast: Equatable, Sendable, Decodable {
    var kind: ChatMessage.Kind
    var text: String?
    var key: String?
    var note: String?
    var deleted: Bool
    var at: Date
    var fromMe: Bool
    /// The `payload.event` of a system or game line (`divan_add`, `game_invite`, …); nil for the rest.
    var event: String?

    enum CodingKeys: String, CodingKey { case kind, text, key, note, deleted, at, fromMe, event }

    init(kind: ChatMessage.Kind, text: String? = nil, key: String? = nil, note: String? = nil, deleted: Bool = false, at: Date, fromMe: Bool, event: String? = nil) {
        self.kind = kind
        self.text = text
        self.key = key
        self.note = note
        self.deleted = deleted
        self.at = at
        self.fromMe = fromMe
        self.event = event
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        kind = try values.decode(ChatMessage.Kind.self, forKey: .kind)
        text = try values.decodeIfPresent(String.self, forKey: .text)
        key = try values.decodeIfPresent(String.self, forKey: .key)
        note = try values.decodeIfPresent(String.self, forKey: .note)
        deleted = try values.decode(Bool.self, forKey: .deleted)
        at = try values.decode(APIDate.self, forKey: .at).date
        fromMe = try values.decode(Bool.self, forKey: .fromMe)
        event = try values.decodeIfPresent(String.self, forKey: .event)
    }
}

/// One row of `GET /v1/conversations`.
struct ConversationItem: Equatable, Identifiable, Sendable, Decodable {
    var id: String
    var other: ChatPerson
    var last: ConversationLast
    var unread: Int
}

/// `Conversation`: what opening a chat answers.
struct Conversation: Equatable, Identifiable, Sendable, Codable {
    var id: String
    var other: ChatPerson
}

struct ConversationPage: Equatable, Sendable, Decodable {
    var items: [ConversationItem]
    var nextCursor: String?
}

/// What a system or game message carries: `{ event, … }` (`divan_add` has the couplet `key`; a `game_invite` the
/// game's `kind`).
struct MessagePayload: Equatable, Sendable, Decodable {
    var event: String
    var key: String?
    var kind: String?
}

/// `Message`.
struct ChatMessage: Equatable, Identifiable, Sendable, Decodable {
    enum Kind: String, Sendable, Decodable {
        case text, couplet, system, game

        /// A kind this app does not know is read as a system line, which hides itself when it has no event it knows.
        init(from decoder: any Decoder) throws {
            self = Kind(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .system
        }
    }

    var id: String
    var conversationId: String
    var kind: Kind
    var fromMe: Bool
    var text: String?
    var key: String?
    var note: String?
    var payload: MessagePayload?
    var deleted: Bool
    var createdAt: Date

    enum CodingKeys: String, CodingKey { case id, conversationId, kind, fromMe, text, key, note, payload, deleted, createdAt }

    init(
        id: String, conversationId: String, kind: Kind, fromMe: Bool, text: String? = nil, key: String? = nil, note: String? = nil,
        payload: MessagePayload? = nil, deleted: Bool = false, createdAt: Date
    ) {
        self.id = id
        self.conversationId = conversationId
        self.kind = kind
        self.fromMe = fromMe
        self.text = text
        self.key = key
        self.note = note
        self.payload = payload
        self.deleted = deleted
        self.createdAt = createdAt
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        conversationId = try values.decode(String.self, forKey: .conversationId)
        kind = try values.decode(Kind.self, forKey: .kind)
        fromMe = try values.decode(Bool.self, forKey: .fromMe)
        text = try values.decodeIfPresent(String.self, forKey: .text)
        key = try values.decodeIfPresent(String.self, forKey: .key)
        note = try values.decodeIfPresent(String.self, forKey: .note)
        payload = try values.decodeIfPresent(MessagePayload.self, forKey: .payload)
        deleted = try values.decode(Bool.self, forKey: .deleted)
        createdAt = try values.decode(APIDate.self, forKey: .createdAt).date
    }

    /// Counts toward «نخونده», as on the server: anything the other person sent (text, couplet, game), not deleted;
    /// system lines have no sender and never count.
    var countsAsUnread: Bool {
        !fromMe && !deleted && kind != .system
    }
}

/// `MessagePage`: newest first.
struct MessagePage: Equatable, Sendable, Decodable {
    var items: [ChatMessage]
    var nextBefore: String?
    var otherReadMessageId: String?
}

/// A message to send: a text, or a couplet with an optional note. `clientId` makes a retry safe.
struct OutgoingMessage: Equatable, Sendable, Encodable {
    enum Content: Equatable, Sendable {
        case text(String)
        case couplet(key: String, note: String?)
    }

    var clientId: String
    var content: Content

    func encode(to encoder: any Encoder) throws {
        var values = encoder.container(keyedBy: Keys.self)
        try values.encode(clientId, forKey: .clientId)
        switch content {
        case .text(let text):
            try values.encode("text", forKey: .kind)
            try values.encode(text, forKey: .text)
        case .couplet(let key, let note):
            try values.encode("couplet", forKey: .kind)
            try values.encode(key, forKey: .key)
            try values.encodeIfPresent(note, forKey: .note)
        }
    }

    private enum Keys: String, CodingKey { case clientId, kind, text, key, note }
}

/// `SharedDivanCounts`.
struct SharedDivanCounts: Equatable, Sendable, Codable {
    var total: Int
    var mine: Int
    var theirs: Int
}

/// `SharedDivan`: the divan two friends share (`other` has no `online` here).
struct SharedDivan: Equatable, Identifiable, Sendable, Decodable {
    var id: String
    var other: ChatPerson
    var counts: SharedDivanCounts
}

struct SharedDivanPage: Equatable, Sendable, Decodable {
    var items: [SharedDivan]
    var nextCursor: String?
}

/// `SharedDivanItem`.
struct SharedDivanItem: Equatable, Identifiable, Sendable, Decodable {
    var id: String
    var key: String
    var note: String?
    var addedByMe: Bool
    var createdAt: Date
    var likedByMe: Bool
    var likedByThem: Bool

    enum CodingKeys: String, CodingKey { case id, key, note, addedByMe, createdAt, likedByMe, likedByThem }

    init(id: String, key: String, note: String? = nil, addedByMe: Bool, createdAt: Date, likedByMe: Bool = false, likedByThem: Bool = false) {
        self.id = id
        self.key = key
        self.note = note
        self.addedByMe = addedByMe
        self.createdAt = createdAt
        self.likedByMe = likedByMe
        self.likedByThem = likedByThem
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        key = try values.decode(String.self, forKey: .key)
        note = try values.decodeIfPresent(String.self, forKey: .note)
        addedByMe = try values.decode(Bool.self, forKey: .addedByMe)
        createdAt = try values.decode(APIDate.self, forKey: .createdAt).date
        likedByMe = try values.decode(Bool.self, forKey: .likedByMe)
        likedByThem = try values.decode(Bool.self, forKey: .likedByThem)
    }
}

struct SharedDivanItemPage: Equatable, Sendable, Decodable {
    var items: [SharedDivanItem]
    var nextCursor: String?
    var counts: SharedDivanCounts
}

/// Which couplets of a shared divan the server lists: `by=me|them|all`.
enum SharedDivanAuthor: String, Sendable {
    case all, me, them
}

/// The reasons of `POST /v1/reports`.
enum ReportReason: String, CaseIterable, Sendable {
    case spam, abuse, other

    var title: String {
        switch self {
        case .spam: "اسپم"
        case .abuse: "بی‌احترامی"
        case .other: "یه چیز دیگه"
        }
    }
}

/// A time of the contract: an ISO-8601 string, with or without milliseconds.
struct APIDate: Decodable, Equatable, Sendable {
    var date: Date

    init(from decoder: any Decoder) throws {
        let text = try decoder.singleValueContainer().decode(String.self)
        guard let milliseconds = DivanTime.milliseconds(text) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "not a date: \(text)"))
        }
        date = DivanTime.date(milliseconds)
    }
}
