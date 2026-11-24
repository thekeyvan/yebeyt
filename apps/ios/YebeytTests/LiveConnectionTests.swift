import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct LiveConnectionTests {
    /// A connection on fake sockets. Tokens are «t1», «t2», … one per call; every backoff wait is recorded and takes 2 ms.
    @MainActor final class Rig {
        let sockets = FakeLiveSockets()
        let waits = Recorded<Duration>()
        var events: [LiveEvent] = []
        var readyCount = 0
        var refreshes = 0
        var tokenCalls = 0
        var refreshError: APIError?
        var tokenError: APIError?
        /// When set, the token of the next call waits for `releaseToken`.
        var holdsToken = false
        var tokenWaiter: CheckedContinuation<Void, Never>?
        var connection: LiveConnection!

        init(pingEvery: Duration = .seconds(1000)) {
            let waits = self.waits
            connection = LiveConnection(
                url: URL(string: "wss://example.test/v1/live")!, factory: sockets,
                token: { [unowned self] in
                    if let tokenError { throw tokenError }
                    tokenCalls += 1
                    let mine = "t\(tokenCalls)"
                    if holdsToken {
                        holdsToken = false
                        await withCheckedContinuation { tokenWaiter = $0 }
                    }
                    return mine
                },
                refresh: { [unowned self] in
                    refreshes += 1
                    if let refreshError { throw refreshError }
                },
                backoff: LiveBackoff(jitter: { 1 }), pingEvery: pingEvery, pingTimeout: .milliseconds(200),
                wait: { waits.add($0); try await Task.sleep(for: .milliseconds(2)) },
                onEvent: { [unowned self] in events.append($0) }, onReady: { [unowned self] in readyCount += 1 }
            )
        }

        func releaseToken() {
            tokenWaiter?.resume()
            tokenWaiter = nil
        }

        func authToken(of socket: FakeLiveSocket) -> String? {
            guard let frame = socket.sent.first, let json = try? JSONSerialization.jsonObject(with: Data(frame.utf8)) as? [String: String] else { return nil }
            return json["type"] == "auth" ? json["token"] : nil
        }
    }

    @Test func theTokenIsTheFirstMessageAndReadyOpensTheDoor() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 && rig.sockets.sockets[0].sent.count == 1 })
        let socket = rig.sockets.sockets[0]
        #expect(rig.authToken(of: socket) == "t1")
        #expect(socket.sent.count == 1)
        #expect(rig.connection.state == .connecting)
        socket.readyFrame()
        #expect(await eventually { rig.connection.state == .ready })
        #expect(rig.readyCount == 1)
        rig.connection.stop()
    }

    @Test func eventsAreHandedOnAndUnknownFramesAreSkipped() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.first != nil })
        let socket = rig.sockets.sockets[0]
        socket.readyFrame()
        socket.push("not json")
        socket.push(#"{"type":"presence","username":"sara","online":true}"#)
        socket.push(#"{"type":"game.started","gameId":"g"}"#)
        #expect(await eventually { rig.events.count == 2 })
        #expect(rig.events == [.presence(username: "sara", online: true), .other("game.started")])
        rig.connection.stop()
    }

    @Test func aLostConnectionIsTriedAgainWithAGrowingWait() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].readyFrame()
        #expect(await eventually { rig.connection.state == .ready })
        rig.sockets.sockets[0].end(code: nil)  // was ready: wait 1 s
        #expect(await eventually { rig.sockets.sockets.count == 2 })
        rig.sockets.sockets[1].end(code: 1006)  // never ready: 2 s
        #expect(await eventually { rig.sockets.sockets.count == 3 })
        rig.sockets.sockets[2].end(code: nil)  // 4 s
        #expect(await eventually { rig.sockets.sockets.count == 4 })
        rig.sockets.sockets[3].readyFrame()
        #expect(await eventually { rig.readyCount == 2 })
        #expect(rig.waits.all == [.seconds(1), .seconds(2), .seconds(4)])
        // Back and ready, the next loss starts from a second again.
        rig.sockets.sockets[3].end(code: nil)
        #expect(await eventually { rig.sockets.sockets.count == 5 })
        #expect(rig.waits.all.last == .seconds(1))
        rig.connection.stop()
    }

    @Test func theWaitNeverPassesThirtySeconds() {
        let backoff = LiveBackoff(jitter: { 1 })
        #expect((1...8).map { backoff.delay(afterFailures: $0) } == [.seconds(1), .seconds(2), .seconds(4), .seconds(8), .seconds(16), .seconds(30), .seconds(30), .seconds(30)])
    }

    @Test func anExpiredTokenRefreshesTheSessionAndReconnectsAtOnce() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].readyFrame()
        #expect(await eventually { rig.connection.state == .ready })
        rig.sockets.sockets[0].end(code: 4401)
        #expect(await eventually { rig.sockets.sockets.count == 2 && rig.sockets.sockets[1].sent.count == 1 })
        #expect(rig.refreshes == 1)
        #expect(rig.authToken(of: rig.sockets.sockets[1]) == "t2")
        #expect(rig.waits.all.isEmpty)
        rig.connection.stop()
    }

    @Test func aTokenRefusedAtTheDoorTwiceInARowWaitsBeforeTheThirdTry() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].end(code: 4401)
        #expect(await eventually { rig.sockets.sockets.count == 2 })
        rig.sockets.sockets[1].end(code: 4401)
        #expect(await eventually { rig.sockets.sockets.count == 3 })
        #expect(rig.refreshes == 2)
        #expect(rig.waits.all == [.seconds(2)])
        rig.connection.stop()
    }

    @Test func aRefusedRefreshMeansSignedOutAndStops() async {
        let rig = Rig()
        rig.refreshError = .server(status: 401, code: .unauthorized, allowedAt: nil)
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].end(code: 4401)
        #expect(await eventually { rig.connection.state == .stopped })
        try? await Task.sleep(for: .milliseconds(30))
        #expect(rig.sockets.sockets.count == 1)
    }

    @Test func noTokenAtAllStopsWhenSignedOutAndWaitsOnABadNetwork() async {
        let rig = Rig()
        rig.tokenError = .server(status: 401, code: .unauthorized, allowedAt: nil)
        rig.connection.start()
        #expect(await eventually { rig.connection.state == .stopped })
        #expect(rig.sockets.sockets.isEmpty)
        rig.tokenError = .network
        rig.connection.start()
        #expect(await eventually { rig.waits.all.count >= 2 })
        #expect(Array(rig.waits.all.prefix(2)) == [.seconds(1), .seconds(2)])
        rig.connection.stop()
    }

    @Test func beingReplacedByASixthSocketStopsUntilTheNextForeground() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].readyFrame()
        #expect(await eventually { rig.connection.state == .ready })
        rig.sockets.sockets[0].end(code: 4409)
        #expect(await eventually { rig.connection.state == .evicted })
        rig.connection.start()  // does not fight
        try? await Task.sleep(for: .milliseconds(30))
        #expect(rig.sockets.sockets.count == 1)
        #expect(rig.waits.all.isEmpty)
        rig.connection.stop()  // the app goes to the background …
        rig.connection.start()  // … and comes back
        #expect(await eventually { rig.sockets.sockets.count == 2 })
        rig.connection.stop()
    }

    @Test func noUsernameStops() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].end(code: 4403)
        #expect(await eventually { rig.connection.state == .stopped })
        #expect(rig.waits.all.isEmpty)
    }

    @Test func stoppingClosesTheSocketAndSaysNothingMore() async {
        let rig = Rig()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        let socket = rig.sockets.sockets[0]
        socket.readyFrame()
        #expect(await eventually { rig.connection.state == .ready })
        rig.connection.stop()
        #expect(socket.closedByClient)
        #expect(rig.connection.state == .stopped)
        socket.push(#"{"type":"presence","username":"sara","online":false}"#)
        try? await Task.sleep(for: .milliseconds(30))
        #expect(rig.events.isEmpty)
        #expect(rig.sockets.sockets.count == 1)
    }

    @Test func aSocketThatDoesNotAnswerPingsIsDroppedAndReopened() async {
        let rig = Rig(pingEvery: .milliseconds(10))
        rig.sockets.answersPings = false
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].readyFrame()
        #expect(await eventually { rig.sockets.sockets.count >= 2 })
        #expect(rig.sockets.sockets[0].closedByClient)
        rig.connection.stop()
    }

    @Test func aPingThatNeverComesBackClosesTheSocketAndReconnects() async {
        let rig = Rig(pingEvery: .milliseconds(10))
        rig.sockets.hangsPings = true
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.sockets.sockets[0].readyFrame()
        // The timeout is 200 ms in the rig: the ping is given up, the socket is closed, and a new one opens.
        #expect(await eventually { rig.sockets.sockets.count >= 2 })
        #expect(rig.sockets.sockets[0].closedByClient)
        rig.connection.stop()
    }

    @Test func aRunStoppedWhileItsTokenWasComingOpensNothingAndLeavesTheNewRunAlone() async {
        let rig = Rig()
        rig.holdsToken = true
        rig.connection.start()  // its token is held
        #expect(await eventually { rig.tokenCalls == 1 })
        rig.connection.stop()  // the app goes away …
        rig.connection.start()  // … and comes back: a new run, with its own token
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        rig.releaseToken()  // the old token arrives late
        try? await Task.sleep(for: .milliseconds(50))
        #expect(rig.sockets.sockets.count == 1)  // the old run opened no socket of its own
        rig.sockets.sockets[0].readyFrame()
        #expect(await eventually { rig.connection.state == .ready })
        rig.connection.stop()
        #expect(rig.sockets.sockets[0].closedByClient)  // stop reaches the new run's socket
    }

    @Test func startingTwiceOpensOneSocket() async {
        let rig = Rig()
        rig.connection.start()
        rig.connection.start()
        #expect(await eventually { rig.sockets.sockets.count == 1 })
        try? await Task.sleep(for: .milliseconds(30))
        #expect(rig.sockets.sockets.count == 1)
        rig.connection.stop()
    }

    @Test func theAddressIsTheServersWithTheSocketScheme() {
        #expect(LiveConnection.liveURL(for: URL(string: "https://api.yebeyt.com")!).absoluteString == "wss://api.yebeyt.com/v1/live")
        #expect(LiveConnection.liveURL(for: URL(string: "http://localhost:8080")!).absoluteString == "ws://localhost:8080/v1/live")
    }

    // MARK: Decoding

    @Test func everyEventOfTheContractIsDecoded() throws {
        let message = MessageJSON.message(id: "m1", text: "سلام")
        #expect(LiveEvent.decode(#"{"type":"ready"}"#) == .ready)
        guard case .message(let decoded)? = LiveEvent.decode(#"{"type":"message","message":\#(message)}"#) else { throw DecodeFailure() }
        #expect(decoded.id == "m1" && decoded.text == "سلام" && !decoded.fromMe)
        #expect(LiveEvent.decode(#"{"type":"read","conversationId":"c1","username":"sara","messageId":"m1"}"#) == .read(conversationId: "c1", username: "sara", messageId: "m1"))
        #expect(LiveEvent.decode(#"{"type":"deleted","conversationId":"c1","messageId":"m1"}"#) == .deleted(conversationId: "c1", messageId: "m1"))
        #expect(LiveEvent.decode(#"{"type":"presence","username":"sara","online":false}"#) == .presence(username: "sara", online: false))
        let item = MessageJSON.item(id: "i1", key: "/hafez/ghazal/sh3#0", mine: false)
        guard case .divan(let divan, let added)? = LiveEvent.decode(#"{"type":"divan","sharedDivanId":"d1","item":\#(item)}"#) else { throw DecodeFailure() }
        #expect(divan == "d1" && added.key == "/hafez/ghazal/sh3#0" && !added.addedByMe)
        #expect(LiveEvent.decode(#"{"type":"duel.round","round":1}"#) == .other("duel.round"))
        #expect(LiveEvent.decode(#"{"type":"read","conversationId":"c1"}"#) == nil)  // fields missing
        #expect(LiveEvent.decode("[]") == nil)
    }

    struct DecodeFailure: Error {}
}
