import Foundation
import Observation

/// The messages side of the app, built once at launch: the live socket, the inbox, the chats that were opened, the
/// shared divans, the friend requests and the unread total for the tab badge. Live events and the lists meet here.
@MainActor @Observable
final class MessagesCenter {
    let session: Session
    let inbox: InboxModel
    let requests: FriendRequestsModel
    /// The unread messages.
    private(set) var unread = 0 {
        didSet { publishBadge() }
    }
    /// Raised when someone asks or accepts, so a page of that person (or my friends) reads itself again.
    private(set) var friendsRevision = 0

    /// Told when the badge changes: the unread messages plus the incoming friend requests (the tab bar's badge).
    @ObservationIgnored var onUnread: (@MainActor (Int) -> Void)?
    /// Told when the number of incoming requests changes (the badge's VoiceOver label says it apart).
    @ObservationIgnored var onRequests: (@MainActor (Int) -> Void)?
    /// Shows a line («<name> درخواستت رو قبول کرد»).
    @ObservationIgnored var onToast: (@MainActor (String) -> Void)?
    @ObservationIgnored private var published = 0
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
        requests = FriendRequestsModel(session: session)
        requests.onCountChange = { [weak self] count in
            self?.onRequests?(count)
            self?.publishBadge()
        }
    }

    private func publishBadge() {
        let badge = unread + requests.incomingCount
        guard badge != published else { return }
        published = badge
        onUnread?(badge)
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

    /// Events are not kept while the socket is closed: every connect reads again what is on screen (a screen that
    /// comes back reads its own list when it appears).
    func reconnected() async {
        await refreshUnread()
        if inbox.isVisible { await inbox.load() }
        if requests.isVisible { await requests.load() }
        for chat in chats.values {
            if chat.isVisible { await chat.load() } else if chat.phase == .loaded { chat.needsReload = true }
        }
        for divan in divans.values where divan.isVisible { await divan.load() }
    }

    func handle(_ event: LiveEvent) {
        switch event {
        case .message(let message):
            if message.countsAsUnread, chats[message.conversationId]?.isVisible != true { unread += 1 }
        case .deleted:
            Task { await refreshUnread() }
        case .friendRequest(let from):
            requests.received(from: from)
            friendsRevision += 1
        case .friendAccepted(let from):
            requests.removeSent(to: from.username)
            friendsRevision += 1
            onToast?(FriendCopy.accepted(by: from.name))
        default:
            break
        }
        let viewing = Set(chats.values.filter(\.isVisible).map(\.id))
        if inbox.apply(event, viewing: viewing) { Task { await inbox.load() } }
        chats.values.forEach { $0.apply(event) }
        divans.values.forEach { $0.apply(event) }
    }

    // MARK: Friendships changed outside the requests screen

    /// An action on the friendship with `username` went through (on their page or a search row) and ended in `state`:
    /// the request they sent is answered, so the row and the badge drop at once and the server's count is read again;
    /// my friends read themselves again when someone became or stopped being one.
    func friendshipChanged(_ username: String, action: FriendAction, state: Friendship) {
        let answered = action == .accept || action == .reject || (action == .send && state == .friends)
        if answered {
            requests.answered(username)
            Task { await refreshUnread() }
        }
        if action == .cancel || state == .friends { requests.removeSent(to: username) }
        if state == .friends || action == .unfriend { friendsRevision += 1 }
    }

    /// I blocked `username`: any request between us is gone (the server drops them).
    func blocked(_ username: String) {
        requests.removeAll(of: username)
        Task { await refreshUnread() }
    }

    // MARK: Unread

    func refreshUnread() async {
        guard let answer = try? await session.authorized({ try await self.session.api.unread(token: $0) }) else { return }
        requests.setCount(answer.friendRequests)
        unread = answer.total
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
        requests.reset()
        unread = 0
    }
}
