import Foundation

/// How long to wait before the next try: 1, 2, 4, … seconds, never more than 30, each a little randomised.
struct LiveBackoff: Sendable {
    var base: Double = 1
    var cap: Double = 30
    var jitter: @Sendable () -> Double = { Double.random(in: 0.8...1.2) }

    /// `failures` is how many tries in a row failed (1 for the first).
    func delay(afterFailures failures: Int) -> Duration {
        let seconds = min(cap, base * pow(2, Double(max(failures, 1) - 1)))
        return .milliseconds(Int(seconds * jitter() * 1000))
    }
}

/// The one WebSocket (`/v1/live`) the app keeps open while it is in front and someone is signed in. The first
/// message is the access token; the server answers `ready`. It reconnects with a growing wait; when the token has
/// expired (close 4401) it refreshes the session first and tries again at once; when a sixth socket of the same
/// person closed this one (4409) it stops until the next `start()` after a `stop()` (the next time the app
/// comes to the front). Events are handed on as they come; they are not kept while the app is closed or away,
/// so `onReady` (called after every connect) is where the stores read their lists again.
@MainActor
final class LiveConnection {
    enum State: Equatable, Sendable {
        case stopped, connecting, ready, evicted
    }

    private enum Outcome {
        case noToken(APIError)
        case lost(wasReady: Bool, code: Int?)
    }

    private(set) var state = State.stopped
    private let url: URL
    private let factory: any LiveSocketFactory
    private let token: @MainActor () async throws -> String
    private let refresh: @MainActor () async throws -> Void
    private let backoff: LiveBackoff
    private let pingEvery: Duration
    private let pingTimeout: Duration
    private let wait: @Sendable (Duration) async throws -> Void
    private let onEvent: @MainActor (LiveEvent) -> Void
    private let onReady: @MainActor () -> Void
    private var task: Task<Void, Never>?
    private var socket: (any LiveSocket)?

    /// `wait` is what the backoff sleeps with (tests make it instant).
    init(
        url: URL, factory: any LiveSocketFactory = URLSessionLiveSockets(),
        token: @escaping @MainActor () async throws -> String, refresh: @escaping @MainActor () async throws -> Void,
        backoff: LiveBackoff = LiveBackoff(), pingEvery: Duration = .seconds(25), pingTimeout: Duration = .seconds(10),
        wait: @escaping @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) },
        onEvent: @escaping @MainActor (LiveEvent) -> Void, onReady: @escaping @MainActor () -> Void
    ) {
        self.url = url
        self.factory = factory
        self.token = token
        self.refresh = refresh
        self.backoff = backoff
        self.pingEvery = pingEvery
        self.pingTimeout = pingTimeout
        self.wait = wait
        self.onEvent = onEvent
        self.onReady = onReady
    }

    /// `https://api.yebeyt.com` → `wss://api.yebeyt.com/v1/live`.
    static func liveURL(for api: URL) -> URL {
        var parts = URLComponents(url: api.appending(path: "v1/live"), resolvingAgainstBaseURL: false) ?? URLComponents()
        parts.scheme = parts.scheme == "http" ? "ws" : "wss"
        return parts.url ?? api
    }

    /// Opens the socket if it is not open (or being opened). Does nothing after an eviction until `stop()`.
    func start() {
        guard task == nil, state != .evicted else { return }
        state = .connecting
        task = Task { [weak self] in await self?.run() }
    }

    /// Closes the socket and forgets an eviction: the app went to the background or someone signed out.
    func stop() {
        task?.cancel()
        task = nil
        socket?.close()
        socket = nil
        state = .stopped
    }

    private func run() async {
        var failures = 0
        while !Task.isCancelled {
            state = .connecting
            let outcome = await connectOnce()
            if Task.isCancelled { return }
            switch outcome {
            case .noToken(let error):
                if error.isUnauthorized { return finish(.stopped) }  // signed out
                failures += 1
            case .lost(_, 4409?):
                return finish(.evicted)
            case .lost(_, 4403?):
                return finish(.stopped)
            case .lost(let wasReady, 4401?):
                do {
                    try await refresh()
                } catch let error as APIError where error.isUnauthorized {
                    return finish(.stopped)
                } catch {}  // no network now: the next try says so
                failures = wasReady ? 0 : failures + 1
                if failures <= 1 { continue }  // a token that expired is made new and used at once
            case .lost(let wasReady, _):
                failures = wasReady ? 1 : failures + 1
            }
            do { try await wait(backoff.delay(afterFailures: failures)) } catch { return }
        }
    }

    private func finish(_ final: State) {
        state = final
        task = nil
        socket = nil
    }

    private func connectOnce() async -> Outcome {
        let accessToken: String
        do {
            accessToken = try await token()
        } catch let error as APIError {
            return .noToken(error)
        } catch {
            return .noToken(.network)
        }
        // Stopped while the token was coming: this run is old; it must not open a socket or touch the new run's.
        if Task.isCancelled { return .lost(wasReady: false, code: nil) }
        let socket = factory.open(url)
        self.socket = socket  // only the current run gets here: a cancelled one returned above
        var ready = false
        let pinger = Task { [pingEvery, pingTimeout] in
            while !Task.isCancelled {
                try? await Task.sleep(for: pingEvery)
                if Task.isCancelled { return }
                if await !Self.answers(socket, within: pingTimeout) {
                    socket.close()  // the other side is gone: receiving now fails and the loop reconnects
                    return
                }
            }
        }
        defer {
            pinger.cancel()
            socket.close()
        }
        do {
            try await socket.send(Self.authFrame(accessToken))
            while true {
                let frame = try await socket.receive()
                if Task.isCancelled { return .lost(wasReady: ready, code: nil) }  // stopped: say nothing more
                guard let event = LiveEvent.decode(frame) else { continue }
                if event == .ready {
                    ready = true
                    state = .ready
                    onReady()
                } else if ready {
                    onEvent(event)
                }
            }
        } catch let closed as LiveClosed {
            return .lost(wasReady: ready, code: closed.code)
        } catch {
            return .lost(wasReady: ready, code: nil)
        }
    }

    private static func authFrame(_ token: String) -> String {
        struct Auth: Encodable { var type = "auth"; var token: String }
        let data = (try? JSONEncoder().encode(Auth(token: token))) ?? Data()
        return String(decoding: data, as: UTF8.self)
    }

    private static func answers(_ socket: any LiveSocket, within timeout: Duration) async -> Bool {
        await withTaskGroup(of: Bool.self) { group in
            group.addTask { (try? await socket.ping()) != nil }
            group.addTask {
                // Cancelled (the ping was answered): nothing to do. Only a real timeout closes the socket, and that ends
                // a ping that never comes back, which would keep this group waiting.
                do { try await Task.sleep(for: timeout) } catch { return false }
                socket.close()
                return false
            }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }
    }
}
