import Foundation
import MediaPlayer
import os
import Testing
@testable import Yebeyt

@MainActor
struct RecitationPlayerTests {
    @MainActor final class Failures {
        var count = 0
    }

    private let failures = Failures()

    private func recitation() throws -> Recitation {
        try JSONDecoder().decode([Recitation].self, from: Fixtures.data("recitations"))[0]
    }

    private func makePlayer(_ fetch: @escaping @Sendable () async throws -> [Recitation]) -> RecitationPlayer {
        let failures = failures
        return RecitationPlayer(
            couplets: [Couplet(m1: "الف", m2: "ب")], title: "غزل ۳", artist: "حافظ",
            fetchRecitations: fetch, onFailure: { failures.count += 1 }
        )
    }

    private func settle(_ player: RecitationPlayer, until done: () -> Bool) async throws {
        for _ in 0..<200 where !done() { try await Task.sleep(for: .milliseconds(10)) }
    }

    @Test func noRecitationsHidesThePlayButton() async {
        let player = makePlayer { [] }
        #expect(player.isAvailable)
        await player.prefetch()
        #expect(!player.isAvailable)
    }

    @Test func aFailedPrefetchKeepsTheButton() async {
        let player = makePlayer { throw URLError(.notConnectedToInternet) }
        await player.prefetch()
        #expect(player.isAvailable)
    }

    @Test func playingWhenThePoemHasNoRecitationHidesTheButtonWithoutAToast() async throws {
        let player = makePlayer { [] }
        player.toggle()
        try await settle(player) { !player.isAvailable }
        #expect(!player.isAvailable)
        #expect(player.state == .idle)
        #expect(failures.count == 0)
    }

    @Test func aFailureGoesBackToPlayAndCallsOnFailure() async throws {
        let player = makePlayer { throw URLError(.notConnectedToInternet) }
        player.toggle()
        try await settle(player) { failures.count > 0 }
        #expect(failures.count == 1)
        #expect(player.state == .idle)
        #expect(!player.isPlaying)
    }

    @Test func stoppingWhileLoadingIsACancelNotAFailure() async throws {
        let player = makePlayer { try await Task.sleep(for: .seconds(30)); return [] }
        player.toggle()
        #expect(player.state == .loading)
        player.stop()
        try await Task.sleep(for: .milliseconds(100))
        #expect(player.state == .idle)
        #expect(failures.count == 0)
    }

    @Test func tappingAgainWhileLoadingCancels() async throws {
        let player = makePlayer { try await Task.sleep(for: .seconds(30)); return [] }
        player.toggle()
        player.toggle()
        try await Task.sleep(for: .milliseconds(100))
        #expect(player.state == .idle)
        #expect(failures.count == 0)
    }

    @Test func aCancelledRequestIsNotAFailure() async throws {
        let player = makePlayer { throw URLError(.cancelled) }
        player.toggle()
        try await Task.sleep(for: .milliseconds(100))
        #expect(player.state == .idle)
        #expect(failures.count == 0)
    }

    /// A load that was cancelled but finishes late (its request doesn't notice the cancel) must not touch the player.
    @Test func aStaleLoadDoesNothingWhenANewOneHasStarted() async throws {
        let calls = OSAllocatedUnfairLock(initialState: 0)
        let player = makePlayer {
            let call = calls.withLock { $0 += 1; return $0 }
            if call == 1 {
                await Task { try? await Task.sleep(for: .milliseconds(300)) }.value  // not cancelled with its parent
                return []  // would hide the button if it counted
            }
            throw URLError(.notConnectedToInternet)
        }
        player.toggle()  // load 1
        try await settle(player) { calls.withLock { $0 } == 1 }  // it is under way before it is cancelled: the calls are numbered in order
        player.toggle()  // cancel it
        player.toggle()  // load 2, which fails
        try await settle(player) { failures.count > 0 }
        try await Task.sleep(for: .milliseconds(500))  // load 1 finishes now
        #expect(calls.withLock { $0 } == 2)
        #expect(failures.count == 1)
        #expect(player.isAvailable)
        #expect(player.state == .idle)
    }

    // MARK: Where the recitation starts and follows

    private let ghazal = (0..<4).map { Couplet(m1: "الف\($0)", m2: "ب\($0)") }
    private let engines = FakeEngines()

    /// A player over four couplets whose recitation (the fixture's first, or `untimed`: the last) has Ganjoor's timing:
    /// couplets 0, 1 and 2 start at 0, 15.486 and 29.886 seconds.
    private func timedPlayer(untimed: Bool = false, loadingTiming: Duration = .zero) throws -> RecitationPlayer {
        let all = try JSONDecoder().decode([Recitation].self, from: Fixtures.data("recitations"))
        let list = [untimed ? all[2] : all[0]]
        let xml = try Fixtures.data("timing-2130-ff", extension: "xml")
        return RecitationPlayer(
            couplets: ghazal, title: "غزل ۳", artist: "حافظ",
            fetchRecitations: { list }, fetchTiming: { _ in try await Task.sleep(for: loadingTiming); return xml },
            makeEngine: engines.make, onFailure: { [failures] in failures.count += 1 }
        )
    }

    /// Presses play at `couplet` and lets the audio become ready.
    private func play(_ player: RecitationPlayer, at couplet: Int) async throws -> FakeEngine {
        player.toggle(startingAt: couplet)
        try await settle(player) { engines.last != nil }
        let engine = try #require(engines.last)
        engine.events.ready()
        try await settle(player) { engine.isPlaying }
        return engine
    }

    @Test func playStartsAtTheCoupletThatIsShown() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 2)
        #expect(engine.seeks == [29.886])
        #expect(engine.isPlaying)
        #expect(player.state == .playing)
    }

    @Test func nothingPlaysBeforeTheSeekToTheStartIsDone() async throws {
        let player = try timedPlayer()
        player.toggle(startingAt: 2)
        try await settle(player) { engines.last != nil }
        let engine = try #require(engines.last)
        #expect(!engine.isPlaying, "playing first would begin at the wrong place")
        engine.events.tick(0)  // the position before the seek is not the reader's couplet
        #expect(player.activeCouplet == nil)
        engine.answersSeeksAtOnce = false
        engine.events.ready()
        try await settle(player) { !engine.seeks.isEmpty }
        engine.events.tick(0)
        #expect(!engine.isPlaying)
        #expect(player.activeCouplet == nil)
        engine.finishSeeks()
        try await settle(player) { engine.isPlaying }
        engine.events.tick(30)
        #expect(player.activeCouplet == 2)
    }

    @Test func theFirstCoupletStartsFromTheBeginning() async throws {
        let player = try timedPlayer()
        player.toggle(startingAt: 0)
        try await settle(player) { engines.last?.isPlaying == true }
        #expect(engines.last?.seeks == [])
    }

    @Test func withoutTimingItStartsFromTheBeginning() async throws {
        let player = try timedPlayer(untimed: true)
        player.toggle(startingAt: 2)
        try await settle(player) { engines.last?.isPlaying == true }
        #expect(engines.last?.seeks == [])
        #expect(player.state == .playing)
        player.seek(toCouplet: 1)  // nothing to seek by
        try await Task.sleep(for: .milliseconds(50))
        #expect(engines.last?.seeks == [])
    }

    @Test func aResumeAfterAPauseContinuesWhereItPaused() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 2)
        player.toggle(startingAt: 0)  // pause
        #expect(player.state == .paused)
        #expect(!engine.isPlaying)
        player.toggle(startingAt: 3)  // resume: the couplet shown is not where it goes
        #expect(player.state == .playing)
        #expect(engine.isPlaying)
        #expect(engine.seeks == [29.886])
        #expect(engines.made.count == 1)
    }

    @Test func movingToAnotherCoupletSeeksToItsStartAndKeepsPlaying() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 2)
        player.seek(toCouplet: 1)
        try await settle(player) { engine.seeks.count == 2 }
        #expect(engine.seeks == [29.886, 15.486])
        #expect(engine.isPlaying)
        #expect(player.state == .playing)
        #expect(player.activeCouplet == 1)
    }

    @Test func movingWhilePausedSeeksAndStaysPaused() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 2)
        player.toggle()  // pause
        player.seek(toCouplet: 0)
        try await settle(player) { engine.seeks.count == 2 }
        #expect(engine.seeks == [29.886, 0])
        #expect(!engine.isPlaying)
        #expect(player.state == .paused)
        player.toggle()  // play again: from the couplet it was moved to
        #expect(engine.isPlaying)
        #expect(engine.seeks == [29.886, 0])
    }

    @Test func aPositionFromBeforeTheSeekDoesNotMoveTheReaderBack() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 0)
        engine.answersSeeksAtOnce = false
        player.seek(toCouplet: 2)
        try await settle(player) { engine.seeks.count == 1 }
        engine.events.tick(1)  // still the first couplet's audio
        #expect(player.activeCouplet == 2)
        engine.finishSeeks()
        try await settle(player) { player.state == .playing }
        try await Task.sleep(for: .milliseconds(20))
        engine.events.tick(30)
        #expect(player.activeCouplet == 2)
        engine.events.tick(15.5)  // now the audio is what moves it
        #expect(player.activeCouplet == 1)
    }

    @Test func movingWhileItLoadsChangesWhereItStarts() async throws {
        let player = try timedPlayer(loadingTiming: .milliseconds(100))
        player.toggle(startingAt: 1)
        #expect(player.state == .loading)
        player.seek(toCouplet: 2)
        try await settle(player) { engines.last != nil }
        let engine = try #require(engines.last)
        engine.events.ready()
        try await settle(player) { engine.isPlaying }
        #expect(engine.seeks == [29.886])
    }

    @Test func movingWhenNothingPlaysDoesNothing() async throws {
        let player = try timedPlayer()
        player.seek(toCouplet: 2)
        #expect(player.activeCouplet == nil)
        #expect(engines.made.isEmpty)
    }

    @Test func theLockScreenShowsTheTimeAfterASeek() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 0)
        player.seek(toCouplet: 2)
        try await settle(player) { engine.seeks == [29.886] }
        try await Task.sleep(for: .milliseconds(20))
        let info = MPNowPlayingInfoCenter.default().nowPlayingInfo
        #expect(info?[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? Double == 29.886)
        player.stop()
    }

    @Test func startingPartWayInShowsTheTimeOnTheLockScreen() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 2)
        try await settle(player) { MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? Double == 29.886 }
        let info = MPNowPlayingInfoCenter.default().nowPlayingInfo
        #expect(info?[MPNowPlayingInfoPropertyElapsedPlaybackTime] as? Double == 29.886)
        #expect(engine.seconds == 29.886)
        player.stop()
    }

    // Couplet 3 has no start in the fixture's timing (it ends at verse 5).

    @Test func movingToACoupletWithoutAStartStopsFollowingTheAudio() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 0)
        player.seek(toCouplet: 3)
        try await Task.sleep(for: .milliseconds(20))
        #expect(engine.seeks.isEmpty, "there is nowhere to move the audio to")
        engine.events.tick(16)  // the audio is at the second couplet: the page would snap back to it
        #expect(player.activeCouplet == nil)
        engine.events.tick(30)
        #expect(player.activeCouplet == nil)
    }

    @Test func followingStartsAgainWhenTheUserMovesToACoupletWithAStart() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 0)
        player.seek(toCouplet: 3)
        player.seek(toCouplet: 1)
        try await settle(player) { engine.seeks == [15.486] }
        try await Task.sleep(for: .milliseconds(20))
        engine.events.tick(30)
        #expect(player.activeCouplet == 2)
    }

    @Test func followingStartsAgainWhenTheUserPressesPlay() async throws {
        let player = try timedPlayer()
        let engine = try await play(player, at: 0)
        player.seek(toCouplet: 3)
        player.toggle()  // pause
        player.toggle()  // play again
        engine.events.tick(16)
        #expect(player.activeCouplet == 1)
    }

    @Test func startingAtACoupletWithoutAStartPlaysFromTheTopWithoutFollowing() async throws {
        let player = try timedPlayer()
        player.toggle(startingAt: 3)
        try await settle(player) { engines.last?.isPlaying == true }
        let engine = try #require(engines.last)
        #expect(engine.seeks.isEmpty)
        engine.events.tick(16)
        #expect(player.activeCouplet == nil)
    }
}
