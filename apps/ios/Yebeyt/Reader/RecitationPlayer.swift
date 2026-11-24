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
    @ObservationIgnored private let makeEngine: MakeRecitationEngine

    @ObservationIgnored private var recitations: [Recitation]?
    /// Set for a game clip: only this part of the audio is played.
    @ObservationIgnored private var clip: ListenClip?
    @ObservationIgnored private var timing: RecitationTiming?
    @ObservationIgnored private var engine: (any RecitationEngine)?
    /// The couplet a start from idle begins at, kept up to date when the reader moves while the audio loads.
    @ObservationIgnored private var wantedCouplet: Int?
    /// Where the audio goes once its item is ready (a clip's start, or the couplet a start begins at); nil when it plays from 0.
    @ObservationIgnored private var pendingStart: Double?
    /// Seeks under way. Until they are done the position is not where the audio is going, so it does not move `activeCouplet`.
    @ObservationIgnored private var seeksInFlight = 0
    /// The user moved to a couplet the timing has no start for, so the audio could not follow. Until the user presses play
    /// again or moves to a couplet with a start, the audio does not move the page: it would snap back.
    @ObservationIgnored private var apart = false
    @ObservationIgnored private var startTask: Task<Void, Never>?
    /// Counts starts and cancels, so a load that was cancelled and finishes late can tell it is stale and does nothing.
    @ObservationIgnored private var generation = 0

    /// Activating and deactivating the audio session can block, and must keep their order: one serial queue for both.
    private static let sessionQueue = DispatchQueue(label: "com.yebeyt.audio-session")

    /// گوش کن: plays only the clip (the first hemistich of a couplet), from its start to its end. The recitations are
    /// already known, so nothing is fetched; «خوانش باز نشد» comes from `onFailure` as in the reader.
    convenience init(
        clip: ListenClip, title: String, makeEngine: @escaping MakeRecitationEngine = AVRecitationEngine.make,
        onFailure: @escaping @MainActor () -> Void
    ) {
        self.init(couplets: [], title: title, artist: "", fetchRecitations: { [] }, makeEngine: makeEngine, onFailure: onFailure)
        self.clip = clip
    }

    init(
        couplets: [Couplet], title: String, artist: String,
        fetchRecitations: @escaping @Sendable () async throws -> [Recitation],
        fetchTiming: @escaping @Sendable (URL) async throws -> Data = { try await URLSession.shared.data(from: $0).0 },
        makeEngine: @escaping MakeRecitationEngine = AVRecitationEngine.make,
        onFailure: @escaping @MainActor () -> Void
    ) {
        self.couplets = couplets
        self.title = title
        self.artist = artist
        self.fetchRecitations = fetchRecitations
        self.fetchTiming = fetchTiming
        self.makeEngine = makeEngine
        self.onFailure = onFailure
    }

    /// Asks Ganjoor for the recitations as soon as the poem is open, to know whether to show the play button.
    /// A failure here is not final: the button stays and playing tries again.
    func prefetch() async {
        guard recitations == nil, let list = try? await fetchRecitations() else { return }
        recitations = list
        isAvailable = !list.isEmpty
    }

    /// Play / pause. From idle it starts at `couplet` when the recitation has timing (from the beginning otherwise);
    /// a resume after a pause continues where the audio paused, whatever `couplet` is.
    func toggle(startingAt couplet: Int? = nil) {
        switch state {
        case .playing:
            engine?.pause()
            state = .paused
            publishNowPlaying()
        case .paused:
            apart = false
            engine?.play()
            state = .playing
            publishNowPlaying()
        case .loading:
            generation += 1
            startTask?.cancel()
            state = .idle
        case .idle:
            generation += 1
            wantedCouplet = couplet
            apart = false
            state = .loading  // at once, so a second tap before the task runs cancels instead of starting another
            let current = generation
            startTask = Task { await start(current) }
        }
    }

    /// The reader moved to another couplet by the user's hand: the audio goes to where that couplet starts and keeps
    /// playing or staying paused. Does nothing when idle or when the recitation has no timing. Never called for the
    /// reader following the audio (`activeCouplet`), which would loop.
    func seek(toCouplet couplet: Int) {
        switch state {
        case .idle:
            return
        case .loading:
            wantedCouplet = couplet
        case .playing, .paused:
            guard let engine, let timing else { return }
            guard let seconds = timing.start(ofCouplet: couplet, in: couplets) else {
                apart = true
                activeCouplet = nil
                return
            }
            apart = false
            activeCouplet = couplet
            if pendingStart != nil {
                pendingStart = seconds  // the item is not ready yet: it will seek there
            } else {
                move(engine, to: seconds)
            }
        }
    }

    private func move(_ engine: any RecitationEngine, to seconds: Double) {
        seeksInFlight += 1
        let started = generation
        Task { @MainActor in
            let done = await engine.seek(to: seconds)
            guard self.engine === engine else { return }
            self.seeksInFlight -= 1
            guard done, started == self.generation else { return }
            if self.state == .playing { engine.play() }
            self.publishNowPlaying()
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
            // Couplet 0 starts the poem from the beginning, as an untimed recitation does.
            let start = wantedCouplet.flatMap { $0 > 0 ? timing?.start(ofCouplet: $0, in: couplets) : nil }
            begin(recitation.mp3Url, at: start)
            apart = start == nil && (wantedCouplet ?? 0) > 0 && timing != nil  // after `begin`, whose teardown clears it
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

    private func begin(_ url: URL, at start: Double? = nil) {
        teardown()  // never two players at once
        Self.sessionQueue.sync {
            try? AVAudioSession.sharedInstance().setCategory(.playback)
            try? AVAudioSession.sharedInstance().setActive(true)
        }
        if let clip { position = clip.start }
        pendingStart = clip?.start ?? start
        let current = generation
        let engine = makeEngine(url, clip, RecitationEngineEvents(
            tick: { [weak self] in self?.tick($0) },
            ended: { [weak self] in self?.finish() },
            failed: { [weak self] in self?.fail() },
            ready: { [weak self] in self?.startPlayback(generation: current) },
            // The system can pause the audio itself (a call, Siri, headphones unplugged) and resume it; follow it.
            timeControl: { [weak self] in self?.timeControlChanged($0) }
        ))
        self.engine = engine
        // A clip, or a start part-way in, waits for the item to be ready, seeks, and plays only when the seek is done
        // (see `startPlayback`).
        if pendingStart == nil { engine.play() }
        state = .playing
        registerRemoteCommands()
        publishNowPlaying()
    }

    /// The item is ready: seek to where it starts (the clip's start, or the couplet), then play.
    private func startPlayback(generation started: Int) {
        guard let engine, let start = pendingStart else { return }
        pendingStart = nil
        seeksInFlight += 1
        Task { @MainActor in
            await ClipStart.run(engine, at: start, stillWanted: { [weak self] in
                guard let self else { return false }
                return ClipStart.shouldPlay(generation: self.generation, started: started, samePlayer: self.engine === engine, state: self.state)
            })
            guard self.engine === engine else { return }
            self.seeksInFlight -= 1
            self.publishNowPlaying()
        }
    }

    private func timeControlChanged(_ status: AVPlayer.TimeControlStatus) {
        switch (status, state) {
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
        // While the audio is still going to where it was asked to, its position says nothing about the reader.
        guard let timing, !apart, pendingStart == nil, seeksInFlight == 0 else { return }
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
        apart = false
        pendingStart = nil
        seeksInFlight = 0
        if let engine {
            engine.stop()
            self.engine = nil
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
        guard let engine else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: engine.seconds,
            MPNowPlayingInfoPropertyPlaybackRate: state == .playing ? 1.0 : 0.0,
        ]
    }
}
