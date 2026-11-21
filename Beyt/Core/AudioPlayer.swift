import Foundation
import AVFoundation
import MediaPlayer
import UIKit
import Observation

/// Real Ganjoor recitations with line-by-line timing.
/// One poem is "now playing" at a time; it keeps playing while you browse (like Apple Music).
@Observable
final class AudioPlayer {
    struct Recitation: Identifiable, Hashable {
        let id: Int
        let artist: String
        let mp3: URL
        let xml: URL?
    }

    /// What's loaded into the player.
    struct NowPlaying: Equatable {
        let url: String
        let title: String
        let poet: String
        let scene: ArtScene
        let seed: String
        let couplets: [Couplet]
    }

    static let rates: [Float] = [0.75, 1, 1.25, 1.5, 1.75]

    private(set) var now: NowPlaying?
    private(set) var recitations: [Recitation] = []
    private(set) var current = 0
    private(set) var loading = false
    private(set) var playing = false
    private(set) var time: Double = 0
    private(set) var duration: Double = 0
    /// Start time (seconds) of each hemistich, in order.
    private(set) var sync: [Double] = []
    /// Index of the hemistich being read right now.
    private(set) var line: Int?
    private(set) var rate: Float = UserDefaults.standard.object(forKey: "beyt.rate") as? Float ?? 1

    var url: String? { now?.url }
    var artist: String { recitations.indices.contains(current) ? recitations[current].artist : "" }
    /// Couplet being read right now.
    var couplet: Int? { line.map { $0 / 2 } }

    private var player: AVPlayer?
    private var observer: Any?
    private var endObserver: NSObjectProtocol?
    private var listCache: [String: [Recitation]] = [:]
    private var syncCache: [URL: [Double]] = [:]
    private var artwork: MPMediaItemArtwork?

    init() { setupRemoteCommands() }

    // MARK: loading

    /// Readers available for a poem (cached). Empty when there are none or the network failed.
    func recitations(for url: String) async -> [Recitation] {
        if let c = listCache[url] { return c }
        guard let r = try? await AudioPlayer.fetchRecitations(url) else { return [] }
        listCache[url] = r
        return r
    }

    /// Starts a poem (or restarts it with another reader), optionally from a couplet.
    @MainActor
    func play(_ poem: Poem, poet: String, reciter: Int, from coupletIndex: Int? = nil) async {
        let isSame = now?.url == poem.url && current == reciter && player != nil
        if isSame {
            if let i = coupletIndex { await seek(couplet: i) }
            resume()
            return
        }
        teardown()
        loading = true
        let recs = await recitations(for: poem.url)
        guard !recs.isEmpty else { loading = false; return }
        recitations = recs
        current = min(max(0, reciter), recs.count - 1)
        let first = poem.couplets.first?.text ?? poem.url
        now = NowPlaying(url: poem.url, title: poem.title, poet: poet, scene: Content.scene(for: poem.url), seed: first, couplets: poem.couplets)
        if let x = recs[current].xml { sync = await loadSync(x) }
        start(at: coupletIndex.flatMap(startTime(ofCouplet:)) ?? 0)
        loading = false
        makeArtwork()
    }

    func toggle() { playing ? pause() : resume() }

    func pause() {
        player?.pause()
        playing = false
        updateNowPlayingInfo()
    }

    func resume() {
        guard let player else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        if duration > 0, time >= duration - 0.5 { player.seek(to: .zero) }
        player.defaultRate = rate
        player.playImmediately(atRate: rate)
        playing = true
        updateNowPlayingInfo()
    }

    func seek(to seconds: Double) {
        let t = max(0, duration > 0 ? min(seconds, duration - 0.1) : seconds)
        time = t
        updateLine()
        player?.seek(to: CMTime(seconds: t, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        updateNowPlayingInfo()
    }

    @MainActor
    func seek(couplet i: Int) async {
        if sync.isEmpty, recitations.indices.contains(current), let x = recitations[current].xml { sync = await loadSync(x) }
        if let t = startTime(ofCouplet: i) { seek(to: t) }
    }

    func skip(by seconds: Double) { seek(to: time + seconds) }

    func nextCouplet() {
        guard let n = now else { return }
        let i = (couplet ?? -1) + 1
        if i < n.couplets.count, let t = startTime(ofCouplet: i) { seek(to: t) } else { skip(by: 15) }
    }

    func previousCouplet() {
        let c = couplet ?? 0
        // Like a music player: first tap goes back to the start of this couplet, a quick second tap to the one before.
        if let t = startTime(ofCouplet: c), time - t > 2 { seek(to: t) }
        else if let t = startTime(ofCouplet: max(0, c - 1)) { seek(to: t) }
        else { skip(by: -15) }
    }

    func setRate(_ r: Float) {
        rate = r
        UserDefaults.standard.set(r, forKey: "beyt.rate")
        player?.defaultRate = r
        if playing { player?.rate = r }
        updateNowPlayingInfo()
    }

    /// Another reader for the same poem; keeps the place (couplet).
    @MainActor
    func choose(_ i: Int) async {
        guard let n = now, recitations.indices.contains(i), i != current else { return }
        let at = couplet
        let wasPlaying = playing
        let couplets = n.couplets
        teardown(keepNow: true)
        current = i
        if let x = recitations[i].xml { sync = await loadSync(x) }
        start(at: at.flatMap(startTime(ofCouplet:)) ?? 0, autoplay: wasPlaying)
        _ = couplets
    }

    func stop() {
        teardown()
        now = nil
        recitations = []
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    // MARK: engine

    private func startTime(ofCouplet i: Int) -> Double? {
        if sync.indices.contains(i * 2) { return sync[i * 2] }
        guard let n = now, !n.couplets.isEmpty, duration > 0 else { return i == 0 ? 0 : nil }
        return duration * Double(i) / Double(n.couplets.count)
    }

    private func start(at seconds: Double, autoplay: Bool = true) {
        guard recitations.indices.contains(current) else { return }
        let rec = recitations[current]
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        let item = AVPlayerItem(url: rec.mp3)
        item.audioTimePitchAlgorithm = .timeDomain // keeps the voice natural at other speeds
        let p = AVPlayer(playerItem: item)
        p.defaultRate = rate
        player = p
        observer = p.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.2, preferredTimescale: 600), queue: .main) { [weak self] t in
            guard let self else { return }
            self.time = t.seconds
            if let d = p.currentItem?.duration.seconds, d.isFinite, d != self.duration { self.duration = d; self.updateNowPlayingInfo() }
            self.updateLine()
        }
        endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
            self?.playing = false
            self?.updateNowPlayingInfo()
        }
        if seconds > 0 { p.seek(to: CMTime(seconds: seconds, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero); time = seconds }
        if autoplay { p.playImmediately(atRate: rate); playing = true }
        updateLine()
        updateNowPlayingInfo()
    }

    private func teardown(keepNow: Bool = false) {
        if let o = observer { player?.removeTimeObserver(o) }
        if let e = endObserver { NotificationCenter.default.removeObserver(e) }
        observer = nil; endObserver = nil
        player?.pause()
        player = nil
        playing = false
        time = 0
        duration = 0
        line = nil
        sync = []
        if !keepNow { artwork = nil }
    }

    private func updateLine() {
        guard !sync.isEmpty else { line = nil; return }
        var idx: Int? = nil
        for (i, s) in sync.enumerated() where time >= s - 0.05 { idx = i }
        if idx != line { line = idx }
    }

    private func loadSync(_ x: URL) async -> [Double] {
        if let c = syncCache[x] { return c }
        guard let s = try? await AudioPlayer.fetchSync(x) else { return [] }
        syncCache[x] = s
        return s
    }

    // MARK: lock screen & Control Center

    private func setupRemoteCommands() {
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.addTarget { [weak self] _ in self?.resume(); return .success }
        c.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in self?.toggle(); return .success }
        c.nextTrackCommand.addTarget { [weak self] _ in self?.nextCouplet(); return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in self?.previousCouplet(); return .success }
        c.changePlaybackPositionCommand.addTarget { [weak self] e in
            guard let e = e as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            self?.seek(to: e.positionTime); return .success
        }
        c.changePlaybackRateCommand.supportedPlaybackRates = AudioPlayer.rates.map { NSNumber(value: $0) }
        c.changePlaybackRateCommand.addTarget { [weak self] e in
            guard let e = e as? MPChangePlaybackRateCommandEvent else { return .commandFailed }
            self?.setRate(e.playbackRate); return .success
        }
    }

    private func makeArtwork() {
        guard let n = now else { return }
        let (sc, seed) = (n.scene, n.seed)
        Task.detached(priority: .utility) { [weak self] in
            let img = SceneArt.image(scene: sc, seed: seed, text: seed, size: CGSize(width: 400, height: 400), painted: true)
            await MainActor.run {
                self?.artwork = MPMediaItemArtwork(boundsSize: img.size) { _ in img }
                self?.updateNowPlayingInfo()
            }
        }
    }

    private func updateNowPlayingInfo() {
        guard let n = now else { return }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: n.title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: n.poet,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: time,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? Double(rate) : 0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: Double(rate),
        ]
        if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
        if let artwork { info[MPMediaItemPropertyArtwork] = artwork }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    // MARK: network

    private static func fetchRecitations(_ poemURL: String) async throws -> [Recitation] {
        var c = URLComponents(string: "https://api.ganjoor.net/api/ganjoor/poem")!
        c.queryItems = [URLQueryItem(name: "url", value: "/" + poemURL)] +
            ["catInfo", "rhymes", "images", "songs", "comments", "verseDetails", "navigation"].map { URLQueryItem(name: $0, value: "false") } +
            [URLQueryItem(name: "recitations", value: "true")]
        let (d, _) = try await URLSession.shared.data(from: c.url!)
        struct R: Decodable {
            struct Rec: Decodable { let id: Int; let audioArtist: String?; let mp3Url: String?; let xmlUrl: String?; let recitationType: Int? }
            let recitations: [Rec]?
        }
        let r = try JSONDecoder().decode(R.self, from: d)
        return (r.recitations ?? []).compactMap { x in
            guard let m = x.mp3Url, let mu = URL(string: m), (x.recitationType ?? 0) == 0 else { return nil }
            return Recitation(id: x.id, artist: x.audioArtist ?? "خوانش", mp3: mu, xml: x.xmlUrl.flatMap(URL.init(string:)))
        }
    }

    /// Parses the Ganjoor sync XML into hemistich start times (seconds).
    private static func fetchSync(_ url: URL) async throws -> [Double] {
        let (d, _) = try await URLSession.shared.data(from: url)
        let parser = SyncParser()
        let x = XMLParser(data: d)
        x.delegate = parser
        x.parse()
        return parser.pairs.sorted { $0.0 < $1.0 }.filter { $0.0 >= 0 }.map { $0.1 / 1000 }
    }

    private final class SyncParser: NSObject, XMLParserDelegate {
        var pairs: [(Int, Double)] = []
        private var order: Int?, ms: Double?, text = ""
        func parser(_ p: XMLParser, didStartElement e: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String] = [:]) {
            text = ""
            if e == "SyncInfo" { order = nil; ms = nil }
        }
        func parser(_ p: XMLParser, foundCharacters s: String) { text += s }
        func parser(_ p: XMLParser, didEndElement e: String, namespaceURI: String?, qualifiedName: String?) {
            let v = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if e == "VerseOrder" { order = Int(v) }
            if e == "AudioMiliseconds" { ms = Double(v) }
            if e == "SyncInfo", let o = order, let m = ms { pairs.append((o, m)) }
            text = ""
        }
    }
}
