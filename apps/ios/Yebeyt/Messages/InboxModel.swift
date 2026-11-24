import Foundation
import Observation

/// The list of chats: newest message first, with the last message and what is unread. Search only filters the rows
/// already loaded.
@MainActor @Observable
final class InboxModel {
    enum Phase: Equatable {
        case loading, loaded
        case failed(String)
    }

    private(set) var rows: [ConversationItem] = []
    private(set) var phase = Phase.loading
    private(set) var isLoadingMore = false
    var query = ""

    @ObservationIgnored private let session: Session
    @ObservationIgnored private var nextCursor: String?

    init(session: Session) {
        self.session = session
    }

    var hasMore: Bool { nextCursor != nil }

    /// The rows whose name or username holds what was typed (all of them when nothing is typed).
    var visibleRows: [ConversationItem] {
        guard !TextNormalizer.normalize(query).isEmpty else { return rows }
        return rows.filter { TextNormalizer.contains($0.other.name, query: query) || TextNormalizer.contains($0.other.username, query: query) }
    }

    /// The first page. Also what a reconnect calls: the rows are replaced, so what the socket missed shows up.
    func load() async {
        if rows.isEmpty { phase = .loading }
        do {
            let page = try await session.authorized { try await self.session.api.conversations(cursor: nil, token: $0) }
            // Rows of pages loaded further down stay (those the first page now holds move up).
            let fresh = Set(page.items.map(\.id))
            let older = rows.filter { !fresh.contains($0.id) }
            if phase != .loaded || older.isEmpty { nextCursor = page.nextCursor }
            rows = page.items + older
            phase = .loaded
        } catch let error as APIError {
            if rows.isEmpty { phase = .failed(error.persianMessage) }
        } catch {}
    }

    func loadMore() async {
        guard let cursor = nextCursor, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let page = try await session.authorized { try await self.session.api.conversations(cursor: cursor, token: $0) }
            let known = Set(rows.map(\.id))
            rows += page.items.filter { !known.contains($0.id) }
            nextCursor = page.nextCursor
        } catch {}  // scrolling to the end asks again
    }

    /// A live event. Returns true when the inbox should be read again (a message of a chat it doesn't know yet).
    /// `viewing` is the chat the person has open: its unread count stays at zero.
    @discardableResult
    func apply(_ event: LiveEvent, viewing: Set<String>) -> Bool {
        switch event {
        case .message(let message):
            guard let index = rows.firstIndex(where: { $0.id == message.conversationId }) else { return phase == .loaded }
            var row = rows.remove(at: index)
            row.last = ConversationLast(
                kind: message.kind, text: message.text, key: message.key, note: message.note, deleted: message.deleted,
                at: message.createdAt, fromMe: message.fromMe
            )
            if message.countsAsUnread, !viewing.contains(message.conversationId) { row.unread += 1 }
            rows.insert(row, at: 0)
        case .presence(let username, let online):
            if let index = rows.firstIndex(where: { $0.other.username == username }) { rows[index].other.online = online }
        case .deleted(let conversation, _):
            return rows.contains { $0.id == conversation }  // it may have been the last message, or an unread one
        default:
            break
        }
        return false
    }

    /// The person read the chat here: its dot goes out.
    func markRead(conversation: String) {
        guard let index = rows.firstIndex(where: { $0.id == conversation }) else { return }
        rows[index].unread = 0
    }

    func conversation(_ row: ConversationItem) -> Conversation {
        Conversation(id: row.id, other: row.other)
    }

    func reset() {
        rows = []
        nextCursor = nil
        phase = .loading
        query = ""
    }

    /// The line under a name: «تو: فردا معما رو با هم حل کنیم؟», «یه بیت فرستاد», «دعوتت کرد به بازی».
    static func preview(_ last: ConversationLast) -> String {
        let body: String
        switch (last.kind, last.deleted) {
        case (_, true):
            body = MessageCopy.deletedMessage
        case (.text, _):
            body = last.text ?? ""
        case (.couplet, _):
            body = last.fromMe ? "یه بیت فرستادی" : "یه بیت فرستاد"
        case (.game, _):
            body = last.fromMe ? "به بازی دعوتش کردی" : "دعوتت کرد به بازی"
        case (.system, _):
            body = last.fromMe ? "یه بیت به دیوان مشترک اضافه کردی" : "یه بیت به دیوان مشترک اضافه کرد"
        }
        return last.fromMe ? "تو: \(body)" : body
    }
}
