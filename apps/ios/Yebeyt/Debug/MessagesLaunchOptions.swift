#if DEBUG
import Foundation

/// Debug launch arguments of the messages slice: `-beytRoute inbox|chat:<username>|shared:<username>` opens the
/// پیام‌ها tab (the inbox, a chat, or a shared divan) and, with `-beytSignedIn 1`, is answered by `MessagesStub` on the
/// phone. `-beytLive 1` also lets the fake live socket send a message from Sara and her going offline, a moment
/// after the app is ready; `-beytDivanSheet 1` opens the sheet of «به دیوان مشترک». The usernames of the stub are sara, arian, kian, mahsa and bardia.
struct MessagesLaunchOptions {
    enum Route: Equatable {
        case inbox
        case chat(String)
        case shared(String)

        init?(_ text: String) {
            let parts = text.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false).map(String.init)
            switch (parts[0], parts.count > 1 ? parts[1] : nil) {
            case ("inbox", nil): self = .inbox
            case ("chat", let name?) where !name.isEmpty: self = .chat(name)
            case ("shared", let name?) where !name.isEmpty: self = .shared(name)
            default: return nil
            }
        }
    }

    let route: Route?
    /// `-beytLive 1`.
    let live: Bool
    /// `-beytDivanSheet 1`: the sheet of «به دیوان مشترک» is open at launch, for a Hafez couplet.
    let divanSheet: Bool
    /// The fake server answers (`-beytSignedIn 1`, or a feedback stub), so the socket is fake too.
    let stubbed: Bool

    init(_ values: [String: Any]) {
        route = (values["beytRoute"] as? String).flatMap(Route.init)
        live = (values["beytLive"] as? Int) == 1 || (values["beytLive"] as? String) == "1"
        divanSheet = (values["beytDivanSheet"] as? Int) == 1 || (values["beytDivanSheet"] as? String) == "1"
        let account = AccountLaunchOptions(values)
        stubbed = account.signedIn || account.feedbackStub
    }

    static var fromProcess: MessagesLaunchOptions {
        MessagesLaunchOptions(UserDefaults.standard.dictionaryRepresentation())
    }

    var sockets: any LiveSocketFactory {
        stubbed ? DebugLiveSockets(sendsEvents: live) : URLSessionLiveSockets()
    }

    /// Opens what the route names on the پیام‌ها tab.
    @MainActor func prepare(center: MessagesCenter, app: AppModel) {
        switch route {
        case .inbox:
            app.select(.messages)
        case .chat(let username):
            let conversation = MessagesStub.conversation(username)
            _ = center.chat(for: conversation)
            app.select(.messages)
            app.messagesPath = [.chat(conversation.id)]
        case .shared(let username):
            app.select(.messages)
            app.messagesPath = [.sharedDivan(username)]
        case nil:
            break
        }
        if divanSheet { app.sharedTarget = SharedDivanTarget(key: "/hafez/ghazal/sh8#4", person: nil) }
    }
}

/// The fake live socket: ready at once, and with `-beytLive 1` a message and a presence change a little later.
struct DebugLiveSockets: LiveSocketFactory {
    let sendsEvents: Bool

    func open(_ url: URL) -> any LiveSocket {
        DebugLiveSocket(sendsEvents: sendsEvents)
    }
}

private final class DebugLiveSocket: LiveSocket, @unchecked Sendable {
    private let continuation: AsyncStream<String>.Continuation
    private var frames: AsyncStream<String>.AsyncIterator

    init(sendsEvents: Bool) {
        let (stream, continuation) = AsyncStream<String>.makeStream()
        self.continuation = continuation
        frames = stream.makeAsyncIterator()
        continuation.yield(#"{"type":"ready"}"#)
        if sendsEvents {
            Task {
                try? await Task.sleep(for: .seconds(1.5))
                continuation.yield(MessagesStub.liveMessageFrame)
            }
        }
    }

    func send(_ text: String) async throws {}

    func receive() async throws -> String {
        guard let frame = await frames.next() else { throw LiveClosed(code: nil) }
        return frame
    }

    func ping() async throws {}

    func close() {
        continuation.finish()
    }
}
#endif
