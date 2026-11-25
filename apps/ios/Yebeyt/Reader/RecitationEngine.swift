import AVFoundation

/// What `RecitationPlayer` asks of the audio underneath it. The real one is an AVPlayer; the tests use a fake that
/// writes down what it is asked.
@MainActor protocol RecitationEngine: AnyObject, ClipTransport {
    /// Where the audio is, in seconds from the start of the recording.
    var seconds: Double { get }
    func pause()
    /// Pauses and lets go of the audio and everything watching it.
    func stop()
}

/// What the engine tells the player. All of it arrives on the main actor.
struct RecitationEngineEvents {
    /// The playback position, a few times a second while playing.
    var tick: @MainActor (Double) -> Void
    var ended: @MainActor () -> Void
    var failed: @MainActor () -> Void
    /// The item can play (a clip, or a start part-way in, seeks now).
    var ready: @MainActor () -> Void
    /// The system started or paused the audio itself (a call, Siri, headphones unplugged), or the user did.
    var timeControl: @MainActor (AVPlayer.TimeControlStatus) -> Void
}

typealias MakeRecitationEngine = @MainActor (URL, ListenClip?, RecitationEngineEvents) -> any RecitationEngine

@MainActor final class AVRecitationEngine: RecitationEngine {
    private let player: AVPlayer
    private var timeObserver: Any?
    private var statusObserver: NSKeyValueObservation?
    private var controlObserver: NSKeyValueObservation?
    private var endObserver: (any NSObjectProtocol)?

    static let make: MakeRecitationEngine = { url, clip, events in AVRecitationEngine(url: url, clip: clip, events: events) }

    init(url: URL, clip: ListenClip?, events: RecitationEngineEvents) {
        // Precise timing, so a seek lands on the clip's start or the couplet's, also in a streamed mp3 with a variable
        // bit rate. A clip's item ends at the clip's end, exactly, and the end notification below finishes the clip.
        let item = AVPlayerItem(asset: AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]))
        if let clip {
            item.forwardPlaybackEndTime = Self.time(clip.end)
            // The tracks of a streamed mp3 are known only a moment later; the fade is at the clip's end, so it is in time.
            Task { @MainActor [weak item] in
                guard let item, let mix = await ListenClipRange.audioMix(for: item.asset, clip: clip) else { return }
                item.audioMix = mix
            }
        }
        player = AVPlayer(playerItem: item)
        statusObserver = item.observe(\.status) { item, _ in
            switch item.status {
            case .failed: Task { @MainActor in events.failed() }
            case .readyToPlay: Task { @MainActor in events.ready() }
            default: break
            }
        }
        endObserver = NotificationCenter.default.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main) { _ in
            MainActor.assumeIsolated { events.ended() }
        }
        controlObserver = player.observe(\.timeControlStatus) { player, _ in
            Task { @MainActor in events.timeControl(player.timeControlStatus) }
        }
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: clip == nil ? 0.25 : 0.1, preferredTimescale: 600), queue: .main) { time in
            MainActor.assumeIsolated { events.tick(time.seconds) }
        }
    }

    var seconds: Double {
        let time = player.currentTime().seconds
        return time.isFinite ? time : 0
    }

    func play() { player.play() }

    func pause() { player.pause() }

    func seek(to seconds: Double) async -> Bool {
        await player.seek(to: Self.time(seconds), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    /// Whole milliseconds, which is what Ganjoor's timing files are in: a 600 timescale would round some starts down
    /// (3.347 s to 3.34667 s) and the first tick would read the couplet before.
    nonisolated static func time(_ seconds: Double) -> CMTime {
        CMTime(value: Int64((seconds * 1000).rounded()), timescale: 1000)
    }

    func stop() {
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        timeObserver = nil
        endObserver = nil
        statusObserver = nil
        controlObserver = nil
        player.pause()
    }
}
