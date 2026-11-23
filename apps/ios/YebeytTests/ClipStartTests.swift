import Testing
@testable import Yebeyt

@MainActor
struct ClipStartTests {
    /// A player that only writes down what it is asked, and answers the seek when the test says so.
    @MainActor final class FakeTransport: ClipTransport {
        var events: [String] = []
        private var pending: CheckedContinuation<Bool, Never>?

        func seek(to seconds: Double) async -> Bool {
            events.append("seek \(seconds)")
            return await withCheckedContinuation { pending = $0 }
        }

        func play() { events.append("play") }

        func finishSeek(_ finished: Bool) {
            pending?.resume(returning: finished)
            pending = nil
        }
    }

    private func settle() async {
        for _ in 0..<10 { await Task.yield() }
    }

    @Test func playsOnlyAfterTheSeekIsDone() async {
        let transport = FakeTransport()
        let task = Task { await ClipStart.run(transport, at: 15.486, stillWanted: { true }) }
        await settle()
        #expect(transport.events == ["seek 15.486"], "nothing plays while the seek is under way")
        transport.finishSeek(true)
        await task.value
        #expect(transport.events == ["seek 15.486", "play"])
    }

    @Test func aSeekCutShortPlaysNothing() async {
        let transport = FakeTransport()
        let task = Task { await ClipStart.run(transport, at: 3, stillWanted: { true }) }
        await settle()
        transport.finishSeek(false)
        await task.value
        #expect(transport.events == ["seek 3.0"])
    }

    @MainActor final class Flag {
        var wanted = true
    }

    @Test func aPlayerThatWasStoppedMeanwhilePlaysNothing() async {
        let transport = FakeTransport()
        let flag = Flag()
        let task = Task { await ClipStart.run(transport, at: 3, stillWanted: { flag.wanted }) }
        await settle()
        flag.wanted = false
        transport.finishSeek(true)
        await task.value
        #expect(transport.events == ["seek 3.0"])
    }
}
