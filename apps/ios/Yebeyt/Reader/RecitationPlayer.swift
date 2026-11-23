import AVFoundation
import Foundation
import MediaPlayer
import Observation

/// Plays a poem's first recitation from Ganjoor and follows along with the text when the recitation
/// comes with a timing file. `activeCouplet` is the couplet being read.
@MainActor @Observable
final class RecitationPlayer {
    enum State: Equatable { case idle, loading, playing, paused }

    private(set) var state = State.idle
    /// False once Ganjoor is known to have no recitation of the poem: the play buttons are hidden.
    private(set) var isAvailable = true
    private(set) var activeCouplet: Int?
    /// A game clip: where the audio is, in seconds from the start of the recitation.
    private(set) var position = 0.0

    var isPlaying: Bool { state == .playing || state == .loading }

    @ObservationIgnored private let couplets: [Couplet]
    @ObservationIgnored private let title: String
    @ObservationIgnored private let artist: String
    @ObservationIgnored private let fetchRecitations: @Sendable () async throws -> [Recitation]
    @ObservationIgnored private let fetchTiming: @Sendable (URL) async throws -> Data
    @ObservationIgnored private let onFailure: @MainActor () -> Void

    @ObservationIgnored private var recitations: [Recitation]?
    /// Set for a game clip: only this part of the audio is played.
    @ObservationIgnored private var clip: ListenClip?
    @ObservationIgnored private var timing: RecitationTiming?
    @ObservationIgnored private var player: AVPlayer?
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var statusObserver: NSKeyValueObservation?
    @ObservationIgnored private var controlObserver: NSKeyValueObservation?
    @ObservationIgnored private var endObserver: (any NSObjectProtocol)?
    @ObservationIgnored private var startTask: Task<Void, Never>?
    /// Counts starts and cancels, so a load that was cancelled and finishes late can tell it is stale and does nothing.
    @ObservationIgnored private var generation = 0

    /// Activating and deactivating the audio session can block, and must keep their order: one serial queue for both.
    private static let sessionQueue = DispatchQueue(label: "com.yebeyt.audio-session")

    /// گوش کن: plays only the clip (the first hemistich of a couplet), from its start to its end. The recitations are
    /// already known, so nothing is fetched; «خوانش باز نشد» comes from `onFailure` as in the reader.
    convenience init(clip: ListenClip, title: String, onFailure: @escaping @MainActor () -> Void) {
        self.init(couplets: [], title: title, artist: "", fetchRecitations: { [] }, onFailure: onFailure)
        self.clip = clip
    }

    init(
        couplets: [Couplet], title: String, artist: String,
        fetchRecitations: @escaping @Sendable () async throws -> [Recitation],
        fetchTiming: @escaping @Sendable (URL) async throws -> Data = { try await URLSession.shared.data(from: $0).0 },
        onFailure: @escaping @MainActor () -> Void
    ) {
        self.couplets = couplets
        self.title = title
        self.artist = artist
        self.fetchRecitations = fetchRecitations
        self.fetchTiming = fetchTiming
        self.onFailure = onFailure
    }

    /// Asks Ganjoor for the recitations as soon as the poem is open, to know whether to show the play button.
    /// A failure here is not final: the button stays and playing tries again.
    func prefetch() async {
        guard recitations == nil, let list = try? await fetchRecitations() else { return }
        recitations = list
        isAvailable = !list.isEmpty
    }

    func toggle() {
        switch state {
        case .playing:
            player?.pause()
            state = .paused
            publishNowPlaying()
        case .paused:
            player?.play()
            state = .playing
            publishNowPlaying()
        case .loading:
            generation += 1
            startTask?.cancel()
            state = .idle
        case .idle:
            generation += 1
            state = .loading  // at once, so a second tap before the task runs cancels instead of starting another
            let current = generation
            startTask = Task { await start(current) }
        }
    }

    /// Stops and lets go of the audio (the reader closed).
    func stop() {
        generation += 1
        startTask?.cancel()
        teardown()
        state = .idle
        activeCouplet = nil
    }

    private func start(_ current: Int) async {
        if let clip {
            guard current == generation else { return }
            begin(clip.audio)
            return
        }
        do {
            let list: [Recitation]
            if let recitations {
                list = recitations
            } else {
                list = try await fetchRecitations()
                try Task.checkCancellation()
                guard current == generation else { return }
                recitations = list
            }
            guard let recitation = list.first else {
                isAvailable = false
                state = .idle
                return
            }
            timing = nil
            if recitation.inSyncWithText, let xml = recitation.xmlUrl {
                timing = try? await RecitationTiming(xml: fetchTiming(xml))
            }
            try Task.checkCancellation()
            guard current == generation else { return }
            begin(recitation.mp3Url)
        } catch {
            // Stopped while loading, or a newer start took over: nothing went wrong, so no «خوانش باز نشد».
            guard current == generation else { return }
            if Task.isCancelled || error is CancellationError || (error as? URLError)?.code == .cancelled {
                state = .idle
            } else {
                fail()
            }
        }
    }

    private func begin(_ url: URL) {
        teardown()  // never two players at once
        Self.sessionQueue.sync {
            try? AVAudioSession.sharedInstance().setCategory(.playback)
            try? AVAudioSession.sharedInstance().setActive(true)
        }
        let item: AVPlayerItem
        if let clip {
            // Precise timing, so the seek lands on the clip's start; the item ends at the clip's end, exactly, and
            // the end notification below finishes the clip.
            item = AVPlayerItem(asset: AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]))
            item.forwardPlaybackEndTime = CMTime(seconds: clip.end, preferredTimescale: 600)
            position = clip.start
        } else {
            item = AVPlayerItem(url: url)
        }
        let player = AVPlayer(playerItem: item)
        self.player = player
        let current = generation
        statusObserver = item.observe(\.status) { [weak self] item, _ in
            switch item.status {
            case .failed: Task { @MainActor in self?.fail() }
            case .readyToPlay: Task { @MainActor in self?.startClipPlayback(generation: current) }
            default: break
            }
        }
        endObserver = NotificationCenter.default.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.finish() }
        }
        // The system can pause the audio itself (a call, Siri, headphones unplugged) and resume it; follow it.
        controlObserver = player.observe(\.timeControlStatus) { [weak self] _, _ in
            Task { @MainActor in self?.timeControlChanged() }
        }
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: clip == nil ? 0.25 : 0.1, preferredTimescale: 600), queue: .main) { [weak self] time in
            MainActor.assumeIsolated { self?.tick(time.seconds) }
        }
        // A clip waits for the item to be ready, seeks, and plays only when the seek is done (see `startClipPlayback`).
        if clip == nil { player.play() }
        state = .playing
        registerRemoteCommands()
        publishNowPlaying()
    }

    /// The item of a clip is ready: seek to the clip's start, then play.
    private func startClipPlayback(generation started: Int) {
        guard let clip, let player else { return }
        Task { @MainActor in
            await ClipStart.run(AVClipTransport(player: player), at: clip.start, stillWanted: { [weak self] in
                guard let self else { return false }
                return ClipStart.shouldPlay(generation: self.generation, started: started, samePlayer: self.player === player, state: self.state)
            })
        }
    }

    private func timeControlChanged() {
        guard let player else { return }
        switch (player.timeControlStatus, state) {
        case (.paused, .playing):
            state = .paused
            publishNowPlaying()
        case (.playing, .paused):
            state = .playing
            publishNowPlaying()
        default:
            break
        }
    }

    private func tick(_ seconds: Double) {
        guard seconds.isFinite else { return }
        if clip != nil { position = seconds }
        guard let timing else { return }
        let couplet = timing.couplet(at: seconds, in: couplets)
        if couplet != activeCouplet { activeCouplet = couplet }
    }

    private func finish() {
        if let clip { position = clip.end }
        teardown()
        state = .idle
        activeCouplet = nil
    }

    private func fail() {
        teardown()
        state = .idle
        activeCouplet = nil
        onFailure()
    }

    private func teardown() {
        if let timeObserver { player?.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        timeObserver = nil
        endObserver = nil
        statusObserver = nil
        controlObserver = nil
        if player != nil {
            player?.pause()
            player = nil
            Self.sessionQueue.async {
                try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            }
        }
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.removeTarget(nil)
        commands.pauseCommand.removeTarget(nil)
        commands.togglePlayPauseCommand.removeTarget(nil)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    private func registerRemoteCommands() {
        let commands = MPRemoteCommandCenter.shared()
        for command in [commands.playCommand, commands.pauseCommand, commands.togglePlayPauseCommand] {
            command.removeTarget(nil)
        }
        commands.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in if self?.state == .paused { self?.toggle() } }
            return .success
        }
        commands.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in if self?.state == .playing { self?.toggle() } }
            return .success
        }
        commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.toggle() }
            return .success
        }
    }

    private func publishNowPlaying() {
        guard let player else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime().seconds.isFinite ? player.currentTime().seconds : 0,
            MPNowPlayingInfoPropertyPlaybackRate: state == .playing ? 1.0 : 0.0,
        ]
    }
}
