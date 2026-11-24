import Foundation
@testable import Yebeyt

/// JSON of the messages contract and the fakes the messages tests share.
enum MessageJSON {
    static let person = #"{"username":"sara","displayName":"سارا","avatar":null,"online":true}"#

    /// A message as the server writes it. `at` is an ISO-8601 time.
    static func message(
        id: String, conversation: String = "c1", kind: String = "text", fromMe: Bool = false, text: String? = nil, key: String? = nil,
        note: String? = nil, payload: String = "null", deleted: Bool = false, at: String = "2026-11-24T09:40:00.000Z"
    ) -> String {
        func string(_ value: String?) -> String { value.map { "\"\($0)\"" } ?? "null" }
        return """
        {"id":"\(id)","conversationId":"\(conversation)","kind":"\(kind)","fromMe":\(fromMe),"text":\(string(text)),"key":\(string(key)),\
        "note":\(string(note)),"payload":\(payload),"deleted":\(deleted),"createdAt":"\(at)"}
        """
    }

    /// A page, newest first as given.
    static func page(_ messages: [String], before: String? = nil, otherRead: String? = nil) -> String {
        let cursor = before.map { "\"\($0)\"" } ?? "null"
        let read = otherRead.map { "\"\($0)\"" } ?? "null"
        return #"{"items":[\#(messages.joined(separator: ","))],"nextBefore":\#(cursor),"otherReadMessageId":\#(read)}"#
    }

    /// A row of the inbox.
    static func row(
        id: String, username: String, name: String? = nil, kind: String = "text", text: String? = "سلام", key: String? = nil, fromMe: Bool = false,
        unread: Int = 0, at: String = "2026-11-24T09:45:00.000Z", online: String = "null"
    ) -> String {
        func string(_ value: String?) -> String { value.map { "\"\($0)\"" } ?? "null" }
        return """
        {"id":"\(id)","other":{"username":"\(username)","displayName":\(string(name)),"avatar":null,"online":\(online)},\
        "last":{"kind":"\(kind)","text":\(string(text)),"key":\(string(key)),"note":null,"deleted":false,"at":"\(at)","fromMe":\(fromMe)},"unread":\(unread)}
        """
    }

    static func rows(_ rows: [String], next: String? = nil) -> String {
        let cursor = next.map { "\"\($0)\"" } ?? "null"
        return #"{"items":[\#(rows.joined(separator: ","))],"nextCursor":\#(cursor)}"#
    }

    static func decoded(_ json: String) throws -> ChatMessage {
        try JSONDecoder().decode(ChatMessage.self, from: Data(json.utf8))
    }

    static func item(id: String, key: String, mine: Bool, note: String? = nil, likedByMe: Bool = false, likedByThem: Bool = false, at: String = "2026-11-23T09:00:00.000Z") -> String {
        let text = note.map { "\"\($0)\"" } ?? "null"
        return #"{"id":"\#(id)","key":"\#(key)","note":\#(text),"addedByMe":\#(mine),"createdAt":"\#(at)","likedByMe":\#(likedByMe),"likedByThem":\#(likedByThem)}"#
    }
}

/// A WebSocket that tests drive by hand.
final class FakeLiveSocket: LiveSocket, @unchecked Sendable {
    private let lock = NSLock()
    private var frames: [String] = []
    private var closed: LiveClosed?
    private var waiting: CheckedContinuation<String, Error>?
    private var sentFrames: [String] = []
    private var wasClosedByClient = false
    /// Whether a ping is answered.
    var answersPings = true
    /// A ping that never comes back (until the socket is closed).
    var hangsPings = false
    private var hungPing: CheckedContinuation<Void, Error>?

    var sent: [String] { lock.withLock { sentFrames } }
    var closedByClient: Bool { lock.withLock { wasClosedByClient } }

    func send(_ text: String) async throws {
        lock.withLock { sentFrames.append(text) }
    }

    func receive() async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let ready: Result<String, Error>? = lock.withLock {
                if !frames.isEmpty { return .success(frames.removeFirst()) }
                if let closed { return .failure(closed) }
                waiting = continuation
                return nil
            }
            if let ready { continuation.resume(with: ready) }
        }
    }

    func ping() async throws {
        if hangsPings {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                lock.withLock { hungPing = continuation }
            }
        }
        if !answersPings { throw LiveClosed(code: nil) }
    }

    func close() {
        lock.withLock { wasClosedByClient = true }
        end(code: nil)
    }

    /// The server sends a frame.
    func push(_ text: String) {
        let waiter: CheckedContinuation<String, Error>? = lock.withLock {
            if let waiting { self.waiting = nil; return waiting }
            frames.append(text)
            return nil
        }
        waiter?.resume(returning: text)
    }

    /// The server closes with this code (nil: the connection is lost).
    func end(code: Int?) {
        let hung: CheckedContinuation<Void, Error>? = lock.withLock {
            let hung = hungPing
            hungPing = nil
            return hung
        }
        hung?.resume(throwing: LiveClosed(code: code))
        let waiter: CheckedContinuation<String, Error>? = lock.withLock {
            if closed == nil { closed = LiveClosed(code: code) }
            let waiter = waiting
            waiting = nil
            return waiter
        }
        waiter?.resume(throwing: LiveClosed(code: code))
    }

    func readyFrame() { push(#"{"type":"ready"}"#) }
}

final class FakeLiveSockets: LiveSocketFactory, @unchecked Sendable {
    private let lock = NSLock()
    private var opened: [FakeLiveSocket] = []
    var answersPings = true
    var hangsPings = false

    var sockets: [FakeLiveSocket] { lock.withLock { opened } }

    func open(_ url: URL) -> any LiveSocket {
        let socket = FakeLiveSocket()
        socket.answersPings = answersPings
        socket.hangsPings = hangsPings
        lock.withLock { opened.append(socket) }
        return socket
    }
}

/// Waits (by yielding) until `condition` holds; false after about two seconds.
@MainActor
func eventually(_ condition: @MainActor () -> Bool) async -> Bool {
    for _ in 0..<400 {
        if condition() { return true }
        try? await Task.sleep(for: .milliseconds(5))
    }
    return condition()
}

/// A thread-safe list for closures that run off the main actor.
final class Recorded<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [Value] = []
    var all: [Value] { lock.withLock { values } }
    func add(_ value: Value) { lock.withLock { values.append(value) } }
}

/// A signed-in session whose access token is already there, talking to `api`.
@MainActor
func signedInSession(_ api: API) -> Session {
    Session(api: api, store: KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)"), fake: AccountLaunchOptions.debugUser)
}

/// A calendar and a clock that never change: UTC, the Gregorian calendar, Tuesday 24 November 2026, noon.
enum MessageClock {
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    static let now = Date(timeIntervalSince1970: 1_795_521_600)  // 2026-11-24T12:00:00Z

    static func date(_ iso: String) -> Date { DivanTime.date(DivanTime.milliseconds(iso)!) }
}
