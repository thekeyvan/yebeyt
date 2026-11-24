import AVFoundation
import Foundation
@testable import Yebeyt

/// An engine that writes down what the player asks of it and answers the seek when the test says so.
@MainActor final class FakeEngine: RecitationEngine {
    let url: URL
    let clip: ListenClip?
    let events: RecitationEngineEvents
    private(set) var seconds = 0.0
    private(set) var isPlaying = false
    private(set) var isStopped = false
    private(set) var seeks: [Double] = []
    /// False: a seek stays under way until `finishSeeks()`.
    var answersSeeksAtOnce = true
    private var pending: [CheckedContinuation<Bool, Never>] = []

    init(url: URL, clip: ListenClip?, events: RecitationEngineEvents) {
        self.url = url
        self.clip = clip
        self.events = events
    }

    func play() { isPlaying = true }

    func pause() { isPlaying = false }

    func stop() {
        isStopped = true
        isPlaying = false
    }

    func seek(to seconds: Double) async -> Bool {
        seeks.append(seconds)
        self.seconds = seconds
        if answersSeeksAtOnce { return true }
        return await withCheckedContinuation { pending.append($0) }
    }

    func finishSeeks() {
        pending.forEach { $0.resume(returning: true) }
        pending = []
    }
}

/// Hands the player a `FakeEngine` and keeps the ones it made.
@MainActor final class FakeEngines {
    private(set) var made: [FakeEngine] = []
    var last: FakeEngine? { made.last }

    var make: MakeRecitationEngine {
        { [self] url, clip, events in
            let engine = FakeEngine(url: url, clip: clip, events: events)
            made.append(engine)
            return engine
        }
    }
}
