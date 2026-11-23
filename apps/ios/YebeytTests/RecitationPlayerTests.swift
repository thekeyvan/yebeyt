import Foundation
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
}
