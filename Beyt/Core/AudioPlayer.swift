import Foundation
import AVFoundation
import Observation

/// Real Ganjoor recitations: audio plus line-by-line timing, fetched on demand.
@Observable
final class AudioPlayer {
    struct Recitation: Identifiable, Hashable {
        let id: Int
        let artist: String
        let mp3: URL
        let xml: URL?
    }

    enum State: Equatable { case idle, loading, ready, failed }

    private(set) var url: String?
    private(set) var recitations: [Recitation] = []
    private(set) var current = 0
    private(set) var state: State = .idle
    private(set) var playing = false
    private(set) var time: Double = 0
    private(set) var duration: Double = 0
    /// Start time (seconds) of each hemistich, in order.
    private(set) var sync: [Double] = []
    /// Index of the hemistich being read right now.
    private(set) var line: Int?

    private var player: AVPlayer?
    private var observer: Any?
    private var cache: [String: [Recitation]] = [:]

    var artist: String { recitations.indices.contains(current) ? recitations[current].artist : "" }

    /// Loads the list of readers for a poem (cached per poem).
    func prepare(_ poemURL: String, preferred: Int = 0) async {
        if url == poemURL, state == .ready || state == .loading { return }
        stop()
        url = poemURL
        recitations = []
        state = .loading
        if let c = cache[poemURL] {
            recitations = c
        } else {
            do {
                recitations = try await AudioPlayer.fetchRecitations(poemURL)
                cache[poemURL] = recitations
            } catch {
                state = .failed
                return
            }
        }
        guard url == poemURL else { return }
        current = min(preferred, max(0, recitations.count - 1))
        state = recitations.isEmpty ? .failed : .ready
    }

    func toggle() {
        if playing { pause(); return }
        guard state == .ready, recitations.indices.contains(current) else { return }
        if player == nil { start() } else { player?.play(); playing = true }
    }

    func pause() { player?.pause(); playing = false }

    func choose(_ i: Int) {
        guard recitations.indices.contains(i) else { return }
        let wasPlaying = playing
        teardown()
        current = i
        if wasPlaying { start() }
    }

    func stop() {
        teardown()
        url = nil
        state = .idle
    }

    private func teardown() {
        if let o = observer { player?.removeTimeObserver(o) }
        observer = nil
        player?.pause()
        player = nil
        playing = false
        time = 0
        duration = 0
        line = nil
        sync = []
    }

    private func start() {
        let rec = recitations[current]
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        let item = AVPlayerItem(url: rec.mp3)
        let p = AVPlayer(playerItem: item)
        player = p
        observer = p.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.2, preferredTimescale: 600), queue: .main) { [weak self] t in
            guard let self else { return }
            self.time = t.seconds
            if let d = p.currentItem?.duration.seconds, d.isFinite { self.duration = d }
            self.updateLine()
            if self.duration > 0, self.time >= self.duration - 0.25 { self.playing = false }
        }
        p.play()
        playing = true
        if let x = rec.xml {
            Task { [weak self] in
                guard let s = try? await AudioPlayer.fetchSync(x) else { return }
                await MainActor.run { self?.sync = s }
            }
        }
    }

    private func updateLine() {
        guard !sync.isEmpty else { line = nil; return }
        var idx: Int? = nil
        for (i, s) in sync.enumerated() where time >= s { idx = i }
        if idx != line { line = idx }
    }

    // MARK: network

    private static func fetchRecitations(_ poemURL: String) async throws -> [Recitation] {
        var c = URLComponents(string: "https://api.ganjoor.net/api/ganjoor/poem")!
        c.queryItems = [URLQueryItem(name: "url", value: "/" + poemURL)] +
            ["catInfo", "rhymes", "images", "songs", "comments", "verseDetails", "navigation"].map { URLQueryItem(name: $0, value: "false") } +
            [URLQueryItem(name: "recitations", value: "true")]
        let (d, _) = try await URLSession.shared.data(from: c.url!)
        struct R: Decodable {
            struct Rec: Decodable { let id: Int; let audioArtist: String?; let mp3Url: String?; let xmlUrl: String?; let inSyncWithText: Bool?; let recitationType: Int? }
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
        private var el = "", order: Int?, ms: Double?, text = ""
        func parser(_ p: XMLParser, didStartElement e: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String] = [:]) {
            el = e; text = ""
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
