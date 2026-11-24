import Foundation
import Observation

/// One chat: its messages (oldest first), the sends still on their way, the other person's read mark. The view only
/// draws `entries` and calls the methods; live events arrive through `apply`.
@MainActor @Observable
final class ChatModel {
    /// A message of mine that the server has not answered for yet, or has refused. `failed` shows «نرسید · دوباره».
    struct Pending: Identifiable, Equatable, Sendable {
        let clientId: String
        let content: OutgoingMessage.Content
        let createdAt: Date
        var failed = false
        /// The server closed the chat (`messages_closed`): the text stays here, not lost, but cannot be sent again.
        var refused = false

        var id: String { clientId }
    }

    /// One thing drawn in the list: a day label, a message, or a send on its way.
    struct Entry: Identifiable, Equatable {
        enum Content: Equatable {
            case day(String)
            case message(ChatMessage)
            case pending(Pending)
        }

        let id: String
        let content: Content
        /// «دیده شد» goes under this message of mine.
        var seen = false
    }

    enum Phase: Equatable {
        case loading, loaded
        case failed(String)
    }

    static let maxTextLength = 1000
    static let maxNoteLength = 200

    let id: String
    private(set) var other: ChatPerson
    private(set) var messages: [ChatMessage] = []
    private(set) var pending: [Pending] = []
    private(set) var otherReadMessageId: String?
    private(set) var phase = Phase.loading
    private(set) var isLoadingOlder = false
    /// The server refused sends with `messages_closed`: the composer is replaced by a line.
    private(set) var isClosed = false
    /// «لیگ غزل‌باز», when the server told it.
    private(set) var league: String?
    /// A line shown for a moment («یه کم آروم‌تر»); the view clears it.
    var toast: String? {
        didSet { toastSerial += 1 }
    }
    /// Counts every assignment of `toast`, so the same line shown again starts its time over.
    private(set) var toastSerial = 0
    /// The chat is on screen with the app in front: new messages are marked read.
    var isVisible = false {
        didSet {
            guard isVisible else { return }
            // A reconnect skipped this chat while it was covered (a poem open over it): it catches up now.
            if needsReload { run { await $0.load() } }
            markRead()
        }
    }
    /// A reconnect found the chat covered and did not read it; it is read when it is looked at again.
    var needsReload = false
    /// Called after a read mark reached the server, so the unread total can be asked again.
    @ObservationIgnored var onRead: (@MainActor () -> Void)?

    @ObservationIgnored private let session: Session
    @ObservationIgnored private let makeID: @MainActor () -> String
    @ObservationIgnored private let now: @MainActor () -> Date
    @ObservationIgnored private var nextBefore: String?
    @ObservationIgnored private var lastReadSent: String?
    @ObservationIgnored private var inflight: [UUID: Task<Void, Never>] = [:]

    init(
        conversation: Conversation, session: Session, now: @escaping @MainActor () -> Date = { .now },
        makeID: @escaping @MainActor () -> String = { UUID().uuidString.lowercased() }
    ) {
        id = conversation.id
        other = conversation.other
        self.session = session
        self.now = now
        self.makeID = makeID
    }

    var hasOlder: Bool { nextBefore != nil }

    /// «آنلاین · لیگ غزل‌باز»: the online word only when the person lets others see it.
    var statusLine: String? {
        let parts = [other.online == true ? "آنلاین" : nil, league].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The last message of mine the other person has read.
    var seenMessageID: String? {
        guard let readID = otherReadMessageId, let readIndex = messages.firstIndex(where: { $0.id == readID }) else { return nil }
        return messages[...readIndex].last { $0.fromMe && !$0.deleted && ($0.kind == .text || $0.kind == .couplet) }?.id
    }

    // MARK: Loading

    /// The newest page. Also what a reconnect calls, to catch up on what the closed socket missed.
    func load() async {
        needsReload = false
        if messages.isEmpty { phase = .loading }
        do {
            let page = try await session.authorized { try await self.session.api.messages(conversation: self.id, before: nil, token: $0) }
            let first = phase != .loaded
            merge(page.items)
            if first || messages.count <= page.items.count { nextBefore = page.nextBefore }
            otherReadMessageId = page.otherReadMessageId ?? otherReadMessageId
            phase = .loaded
            markRead()
        } catch let error as APIError {
            if messages.isEmpty { phase = .failed(error.persianMessage) }
        } catch {}
    }

    /// The page before the oldest one loaded (the list scrolled to its top).
    func loadOlder() async {
        guard let before = nextBefore, !isLoadingOlder else { return }
        isLoadingOlder = true
        defer { isLoadingOlder = false }
        do {
            let page = try await session.authorized { try await self.session.api.messages(conversation: self.id, before: before, token: $0) }
            merge(page.items)
            nextBefore = page.nextBefore
        } catch {}  // the list stays as it is; scrolling to the top asks again
    }

    func loadLeague() async {
        let username = other.username
        guard let tier = try? await session.authorized({ try await self.session.api.leagueTier(username: username, token: $0) }) else { return }
        league = LeagueName.line(tier: tier)
    }

    // MARK: Sending

    /// A text of mine goes into the list at once, as a send on its way. False when there is nothing to send.
    @discardableResult
    func send(text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return enqueue(.text(trimmed.limited(toUTF16: Self.maxTextLength)))
    }

    @discardableResult
    func sendCouplet(key: String, note: String?) -> Bool {
        let trimmed = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        return enqueue(.couplet(key: key, note: trimmed?.isEmpty == false ? trimmed!.limited(toUTF16: Self.maxNoteLength) : nil))
    }

    /// «نرسید · دوباره»: the same send again, with the same `clientId`, so the server never makes two of it.
    func retry(_ clientId: String) {
        guard let index = pending.firstIndex(where: { $0.clientId == clientId }), pending[index].failed, !pending[index].refused else { return }
        pending[index].failed = false
        run { await $0.deliver(clientId) }
    }

    func discard(_ clientId: String) {
        pending.removeAll { $0.clientId == clientId }
    }

    private func enqueue(_ content: OutgoingMessage.Content) -> Bool {
        guard !isClosed else { return false }
        let clientId = makeID()
        pending.append(Pending(clientId: clientId, content: content, createdAt: now()))
        run { await $0.deliver(clientId) }
        return true
    }

    private func deliver(_ clientId: String) async {
        guard let sending = pending.first(where: { $0.clientId == clientId }) else { return }
        do {
            let outgoing = OutgoingMessage(clientId: clientId, content: sending.content)
            let message = try await session.authorized { try await self.session.api.sendMessage(outgoing, conversation: self.id, token: $0) }
            pending.removeAll { $0.clientId == clientId }
            insert(message)
        } catch let error as APIError {
            if error.code == .messagesClosed {
                isClosed = true
                if let index = pending.firstIndex(where: { $0.clientId == clientId }) {
                    pending[index].failed = true
                    pending[index].refused = true  // kept, so what was typed isn't lost
                }
                return
            }
            if let index = pending.firstIndex(where: { $0.clientId == clientId }) { pending[index].failed = true }
            if case .server(let status, _, _) = error, status == 429 { toast = MessageCopy.slowDown }
        } catch {
            if let index = pending.firstIndex(where: { $0.clientId == clientId }) { pending[index].failed = true }
        }
    }

    // MARK: Messages of others and mine

    /// A message of mine, taken back: the server keeps the row and clears it; both phones get an event.
    func delete(_ message: ChatMessage) async {
        guard message.fromMe, message.kind == .text || message.kind == .couplet else { return }
        do {
            try await session.authorized { try await self.session.api.deleteMessage(id: message.id, token: $0) }
            markDeleted(message.id)
        } catch let error as APIError {
            toast = MessageCopy.toast(for: error)
        } catch {}
    }

    func report(_ message: ChatMessage, reason: ReportReason) async {
        let username = other.username
        do {
            try await session.authorized { try await self.session.api.reportPerson(username: username, messageId: message.id, reason: reason, token: $0) }
            toast = MessageCopy.reported
        } catch let error as APIError {
            toast = MessageCopy.toast(for: error)
        } catch {}
    }

    // MARK: Live

    func apply(_ event: LiveEvent) {
        switch event {
        case .message(let message) where message.conversationId == id:
            if message.fromMe, let index = pending.firstIndex(where: { !$0.failed && Self.matches($0.content, message) }) {
                pending.remove(at: index)  // the event came before the answer of the send
            }
            insert(message)
        case .read(let conversation, let username, let messageId) where conversation == id && username == other.username:
            otherReadMessageId = messageId
        case .deleted(let conversation, let messageId) where conversation == id:
            markDeleted(messageId)
        case .presence(let username, let online) where username == other.username:
            other.online = online
        default:
            break
        }
    }

    private static func matches(_ content: OutgoingMessage.Content, _ message: ChatMessage) -> Bool {
        switch content {
        case .text(let text): message.kind == .text && message.text == text
        case .couplet(let key, _): message.kind == .couplet && message.key == key
        }
    }

    private func insert(_ message: ChatMessage) {
        guard !messages.contains(where: { $0.id == message.id }) else { return }
        merge([message])
        if !message.fromMe { markRead() }
    }

    private func merge(_ incoming: [ChatMessage]) {
        var known = Set(messages.map(\.id))
        for message in incoming where known.insert(message.id).inserted { messages.append(message) }
        messages.sort { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
    }

    private func markDeleted(_ messageId: String) {
        guard let index = messages.firstIndex(where: { $0.id == messageId }) else { return }
        messages[index].deleted = true
        messages[index].text = nil
        messages[index].key = nil
        messages[index].note = nil
    }

    // MARK: Read marks

    /// Tells the server the newest message is read, when the chat is on screen and something of the other person's
    /// came after the last mark.
    func markRead() {
        guard isVisible, let newest = messages.last, let unread = messages.lastIndex(where: \.countsAsUnread) else { return }
        if let sent = lastReadSent, let sentIndex = messages.firstIndex(where: { $0.id == sent }), sentIndex >= unread { return }
        let before = lastReadSent
        lastReadSent = newest.id
        run { model in
            do {
                try await model.session.authorized { try await model.session.api.markRead(conversation: model.id, messageId: newest.id, token: $0) }
                model.onRead?()
            } catch {
                if model.lastReadSent == newest.id { model.lastReadSent = before }
            }
        }
    }

    // MARK: What the list draws

    /// Day labels, messages and sends on their way, oldest first. Of the lines that are not texts or couplets these are
    /// shown: a couplet added to the shared divan, a game that ended, an invitation and a challenge's result.
    func entries(now: Date? = nil, calendar: Calendar = .current) -> [Entry] {
        let today = now ?? self.now()
        let seen = seenMessageID
        var result: [Entry] = []
        var lastDay: Date?
        func day(_ date: Date) {
            guard lastDay.map({ !calendar.isDate($0, inSameDayAs: date) }) ?? true else { return }
            lastDay = date
            let start = calendar.startOfDay(for: date)
            result.append(Entry(id: "day-\(Int(start.timeIntervalSince1970))", content: .day(ChatTime.day(date, now: today, calendar: calendar))))
        }
        for message in messages where Self.isShown(message) {
            day(message.createdAt)
            result.append(Entry(id: message.id, content: .message(message), seen: message.id == seen))
        }
        for sending in pending {
            day(sending.createdAt)
            result.append(Entry(id: sending.clientId, content: .pending(sending)))
        }
        return result
    }

    static func isShown(_ message: ChatMessage) -> Bool {
        switch message.kind {
        case .text, .couplet: true
        case .system: message.payload?.event == "divan_add" || message.payload?.event == "game_ended"
        case .game: message.payload?.event == "game_invite" || message.payload?.event == "challenge_result"
        }
    }

    // MARK: Tasks

    private func run(_ work: @escaping @MainActor (ChatModel) async -> Void) {
        let key = UUID()
        inflight[key] = Task {
            await work(self)
            inflight[key] = nil
        }
    }

    /// Waits for the sends and read marks started so far (for tests).
    func settle() async {
        while let task = inflight.values.first { await task.value }
    }
}
