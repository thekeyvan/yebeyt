import Foundation

/// What the server sends over `/v1/live` that this app uses.
enum LiveEvent: Equatable, Sendable {
    case ready
    case message(ChatMessage)
    case read(conversationId: String, username: String, messageId: String)
    case deleted(conversationId: String, messageId: String)
    case presence(username: String, online: Bool)
    case divan(sharedDivanId: String, item: SharedDivanItem)
    /// The person who added a couplet took it out of the shared divan.
    case divanRemoved(sharedDivanId: String, itemId: String)
    /// Someone asked me to be friends.
    case friendRequest(from: PersonShort)
    /// Someone accepted the request I sent.
    case friendAccepted(from: PersonShort)
    case gameStarted(FriendGame)
    case gameMove(gameId: String, move: MoshMove, scores: [GameScore])
    case gameTurn(gameId: String, username: String, deadline: Date)
    case gameEnded(gameId: String, winner: String?, reason: FriendGame.EndReason, scores: [GameScore], couplets: [DuelResult])
    case duelQuestion(DuelQuestion)
    case duelAnswered(gameId: String, round: Int, username: String)
    case duelRound(gameId: String, round: Int, winner: String?, rightOption: Int, scores: [GameScore])
    case challengeResult(code: String, game: ChallengeGame, result: ChallengeLiveResult)
    case other(String)

    /// The event of a text frame; nil when it is not JSON or its fields are not as the contract says.
    static func decode(_ text: String) -> LiveEvent? {
        struct Frame: Decodable {
            var type: String
            var message: ChatMessage?
            var conversationId: String?
            var username: String?
            var messageId: String?
            var online: Bool?
            var sharedDivanId: String?
            var item: SharedDivanItem?
            var itemId: String?
            var from: PersonShort?
        }
        guard let frame = try? JSONDecoder().decode(Frame.self, from: Data(text.utf8)) else { return nil }
        switch frame.type {
        case "ready":
            return .ready
        case "message":
            return frame.message.map(LiveEvent.message)
        case "read":
            guard let conversationId = frame.conversationId, let username = frame.username, let messageId = frame.messageId else { return nil }
            return .read(conversationId: conversationId, username: username, messageId: messageId)
        case "deleted":
            guard let conversationId = frame.conversationId, let messageId = frame.messageId else { return nil }
            return .deleted(conversationId: conversationId, messageId: messageId)
        case "presence":
            guard let username = frame.username, let online = frame.online else { return nil }
            return .presence(username: username, online: online)
        case "divan":
            guard let id = frame.sharedDivanId, let item = frame.item else { return nil }
            return .divan(sharedDivanId: id, item: item)
        case "divan.removed":
            guard let id = frame.sharedDivanId, let itemId = frame.itemId else { return nil }
            return .divanRemoved(sharedDivanId: id, itemId: itemId)
        case "friend.request":
            return frame.from.map(LiveEvent.friendRequest)
        case "friend.accepted":
            return frame.from.map(LiveEvent.friendAccepted)
        default:
            return decodeGame(type: frame.type, data: Data(text.utf8)) ?? .other(frame.type)
        }
    }
}

/// A socket closed by the server (or lost, when there is no code). 4401: the token is bad or expired; 4403: no
/// username yet; 4409: a sixth socket of the same person closed this one.
struct LiveClosed: Error, Equatable, Sendable {
    var code: Int?
}

/// One WebSocket, as `LiveConnection` needs it. Tests and the debug launch bring their own.
protocol LiveSocket: Sendable {
    func send(_ text: String) async throws
    /// The next text frame; throws `LiveClosed` when the socket is closed or lost.
    func receive() async throws -> String
    /// Returns when the other side answered.
    func ping() async throws
    func close()
}

protocol LiveSocketFactory: Sendable {
    func open(_ url: URL) -> any LiveSocket
}

/// The real socket: a `URLSessionWebSocketTask`.
struct URLSessionLiveSockets: LiveSocketFactory {
    func open(_ url: URL) -> any LiveSocket {
        let task = URLSession.shared.webSocketTask(with: url)
        task.maximumMessageSize = 1 << 20
        task.resume()
        return URLSessionLiveSocket(task: task)
    }
}

private final class URLSessionLiveSocket: LiveSocket, @unchecked Sendable {
    let task: URLSessionWebSocketTask

    init(task: URLSessionWebSocketTask) {
        self.task = task
    }

    func send(_ text: String) async throws {
        do { try await task.send(.string(text)) } catch { throw closed() }
    }

    func receive() async throws -> String {
        do {
            switch try await task.receive() {
            case .string(let text): return text
            case .data(let data): return String(decoding: data, as: UTF8.self)
            @unknown default: return ""
            }
        } catch {
            throw closed()
        }
    }

    func ping() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            task.sendPing { error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
    }

    func close() {
        task.cancel(with: .goingAway, reason: nil)
    }

    private func closed() -> LiveClosed {
        let code = task.closeCode.rawValue
        return LiveClosed(code: code == 0 ? nil : code)
    }
}
