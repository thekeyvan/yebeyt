import Foundation
import Observation

/// The messages side of the app, built once at launch: the live socket, the inbox, the chats that were opened, the
/// shared divans and the unread total for the tab badge. Live events and the lists meet here.
@MainActor @Observable
final class MessagesCenter {
    let session: Session
    let inbox: InboxModel
    /// The total for the «پیام‌ها» badge.
    private(set) var unread = 0 {
        didSet { if unread != oldValue { onUnread?(unread) } }
    }

    /// Told when the total changes (the tab bar's badge).
    @ObservationIgnored var onUnread: (@MainActor (Int) -> Void)?
    /// Pushes a chat on the «پیام‌ها» tab and switches to it.
    @ObservationIgnored var show: (@MainActor (String) -> Void)?

    @ObservationIgnored private var chats: [String: ChatModel] = [:]
    @ObservationIgnored private var divans: [String: SharedDivanModel] = [:]
    @ObservationIgnored private var live: LiveConnection?
    @ObservationIgnored private let sockets: any LiveSocketFactory

    init(session: Session, sockets: any LiveSocketFactory = URLSessionLiveSockets()) {
        self.session = session
        self.sockets = sockets
        inbox = InboxModel(session: session)
    }

    // MARK: The live socket

    /// The app is in front and someone is signed in: the socket is open. Otherwise it is closed.
    func setActive(_ active: Bool) {
        if active, session.isSignedIn {
            makeLive().start()
        } else {
            live?.stop()
        }
    }

    private func makeLive() -> LiveConnection {
        if let live { return live }
        let session = session
        let connection = LiveConnection(
            url: LiveConnection.liveURL(for: session.api.baseURL), factory: sockets,
            token: { try await session.authorized { $0 } }, refresh: { try await session.refresh() },
            onEvent: { [weak self] in self?.handle($0) }, onReady: { [weak self] in Task { await self?.reconnected() } }
        )
        live = connection
        return connection
    }

    /// Events are not kept while the socket is closed: every connect reads the lists again.
    func reconnected() async {
        await refreshUnread()
        if inbox.phase == .loaded { await inbox.load() }
        for chat in chats.values where chat.phase == .loaded { await chat.load() }
        for divan in divans.values where divan.phase == .loaded { await divan.load() }
    }

    func handle(_ event: LiveEvent) {
        switch event {
        case .message(let message):
            if message.countsAsUnread, chats[message.conversationId]?.isVisible != true { unread += 1 }
        case .deleted:
            Task { await refreshUnread() }
        default:
            break
        }
        let viewing = Set(chats.values.filter(\.isVisible).map(\.id))
        if inbox.apply(event, viewing: viewing) { Task { await inbox.load() } }
        chats.values.forEach { $0.apply(event) }
        divans.values.forEach { $0.apply(event) }
    }

    // MARK: Unread

    func refreshUnread() async {
        if let total = try? await session.authorized({ try await self.session.api.unreadTotal(token: $0) }) { unread = total }
    }

    // MARK: Chats and divans

    func chat(for conversation: Conversation) -> ChatModel {
        if let known = chats[conversation.id] { return known }
        let chat = ChatModel(conversation: conversation, session: session)
        chat.onRead = { [weak self, id = conversation.id] in
            self?.inbox.markRead(conversation: id)
            Task { await self?.refreshUnread() }
        }
        chats[conversation.id] = chat
        return chat
    }

    /// A chat already known by its id (opened from the inbox or by `openChat`).
    func chat(id: String) -> ChatModel? { chats[id] }

    func sharedDivan(username: String) -> SharedDivanModel {
        if let known = divans[username] { return known }
        let divan = SharedDivanModel(username: username, session: session)
        divans[username] = divan
        return divan
    }

    /// The entry the person page's «پیام بده» calls: makes or finds the chat with `username`, then shows it on the
    /// «پیام‌ها» tab. Returns the line to show when it could not be opened, else nil.
    func openChat(username: String) async -> String? {
        do {
            let conversation = try await session.authorized { try await self.session.api.openConversation(username: username, token: $0) }
            _ = chat(for: conversation)
            show?(conversation.id)
            return nil
        } catch let error as APIError {
            return MessageCopy.toast(for: error)
        } catch {
            return nil
        }
    }

    /// Signed out: nothing of the account stays in memory.
    func reset() {
        live?.stop()
        chats = [:]
        divans = [:]
        inbox.reset()
        unread = 0
    }
}
