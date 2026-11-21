import Foundation
import Observation

/// All poetry data. Bundled: 1,043 poems with line-by-line meanings (Hafez's ghazals, Khayyam,
/// Baba Taher, and a curated set). Everything else in Ganjoor (246 poets, 139,417 poems) is
/// fetched on demand from Ganjoor's public static data over HTTPS and cached on disk.
@Observable
final class Library {
    private(set) var ready = false
    private(set) var poets: [Poet] = []
    private(set) var poetBySlug: [String: Poet] = [:]
    private(set) var poems: [String: Poem] = [:]
    /// Poems bundled with full text, in a stable order (used for search, fal and random picks).
    private(set) var localPoems: [Poem] = []
    /// Normalised text of every bundled couplet, for fast search.
    private(set) var searchIndex: [SearchEntry] = []
    private var remote: [String: Poem] = [:]
    private var cats: [String: CategoryPage] = [:]

    static let dataBase = URL(string: "https://cdn.jsdelivr.net/gh/ganjoor/ganjoor-data@main/")!
    static let localBooks: Set<String> = ["hafez/ghazal", "khayyam/robaee", "babataher/2beytiha"]

    init() {
        Task.detached(priority: .userInitiated) { [weak self] in
            let (poets, poems) = Library.loadBundled()
            await MainActor.run {
                guard let self else { return }
                self.poets = poets
                self.poetBySlug = Dictionary(uniqueKeysWithValues: poets.map { ($0.slug, $0) })
                self.poems = Dictionary(uniqueKeysWithValues: poems.map { ($0.url, $0) })
                self.localPoems = poems
                self.ready = true
            }
            let index = poems.flatMap { p in p.couplets.enumerated().map { SearchEntry(url: p.url, index: $0.offset, text: ($0.element.m1 + " " + $0.element.m2).norm, meaning: $0.element.meaning.norm) } }
            await MainActor.run { self?.searchIndex = index }
        }
    }

    private static func loadBundled() -> ([Poet], [Poem]) {
        let dec = JSONDecoder()
        var poets: [Poet] = [], poems: [Poem] = []
        if let u = Bundle.main.url(forResource: "poets", withExtension: "json"),
           let d = try? Data(contentsOf: u), let raw = try? dec.decode([RawPoet].self, from: d) {
            poets = raw.map(\.poet)
        }
        if let u = Bundle.main.url(forResource: "poems", withExtension: "json"),
           let d = try? Data(contentsOf: u), let raw = try? dec.decode([RawPoem].self, from: d) {
            poems = raw.map(\.poem)
        }
        return (poets, poems)
    }

    // MARK: lookups

    func poet(_ slug: String) -> Poet? { poetBySlug[slug] }
    func nick(_ slug: String) -> String { poetBySlug[slug]?.nick ?? slug }
    func poem(_ url: String) -> Poem? { poems[url] ?? remote[url] }
    func couplet(_ r: CoupletRef) -> Couplet? {
        guard let p = poem(r.url), p.couplets.indices.contains(r.index) else { return nil }
        return p.couplets[r.index]
    }
    var allBooks: [Book] { poets.flatMap(\.books) }
    func book(_ url: String) -> Book? { allBooks.first { $0.url == url } }
    func isLocalBook(_ url: String) -> Bool { Library.localBooks.contains(url) }
    func localPoems(in book: String) -> [Poem] { localPoems.filter { $0.url.hasPrefix(book + "/") } }

    func random(_ filter: (Poem) -> Bool = { _ in true }) -> Poem? { localPoems.filter(filter).randomElement() }
    func randomCouplets(_ n: Int) -> [CoupletRef] {
        (0..<n).compactMap { _ in
            guard let p = localPoems.randomElement(), !p.couplets.isEmpty else { return nil }
            return CoupletRef(p.url, Int.random(in: 0..<p.couplets.count))
        }
    }

    // MARK: remote (Ganjoor public data)

    private var cacheDir: URL {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("ganjoor", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    private func fetchJSON(_ path: String) async throws -> Data {
        let file = cacheDir.appendingPathComponent(path.replacingOccurrences(of: "/", with: "_"))
        if let d = try? Data(contentsOf: file) { return d }
        let url = Library.dataBase.appendingPathComponent(path)
        let (d, resp) = try await URLSession.shared.data(from: url)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        try? d.write(to: file)
        return d
    }

    /// Loads any poem: bundled ones instantly, the rest from Ganjoor's data.
    func load(_ url: String) async throws -> Poem {
        if let p = poem(url) { return p }
        let d = try await fetchJSON("poets/\(url).json")
        let p = try Library.parseRemotePoem(d, url: url)
        remote[url] = p
        return p
    }

    func category(_ url: String) async throws -> CategoryPage {
        if let c = cats[url] { return c }
        let d = try await fetchJSON("poets/\(url)/_cat.json")
        struct RawCat: Decodable {
            struct I: Decodable { let Title: String; let FullUrl: String }
            let Title: String; let ChildCats: [I]; let Poems: [I]
        }
        let raw = try JSONDecoder().decode(RawCat.self, from: d)
        let trim: (String) -> String = { $0.hasPrefix("/") ? String($0.dropFirst()) : $0 }
        let page = CategoryPage(title: raw.Title,
                                children: raw.ChildCats.map { .init(title: $0.Title, url: trim($0.FullUrl), excerpt: "") },
                                poems: raw.Poems.map { item in
                                    let u = trim(item.FullUrl)
                                    return .init(title: item.Title, url: u, excerpt: poem(u)?.couplets.first?.m1 ?? "")
                                })
        cats[url] = page
        return page
    }

    private static func parseRemotePoem(_ d: Data, url: String) throws -> Poem {
        struct V: Decodable { let VOrder: Int; let Position: String; let Text: String; let CoupletIndex: Int?; let CoupletSummary: String? }
        struct M: Decodable { let Rhythm: String? }
        struct R: Decodable { let Title: String; let PoemSummary: String?; let RhymeLetters: String?; let Metre: M?; let Verses: [V] }
        let r = try JSONDecoder().decode(R.self, from: d)
        var couplets: [Couplet] = []
        var current: [V] = []
        var currentIndex: Int? = nil
        func flush() {
            guard !current.isEmpty else { return }
            let texts = current.map(\.Text)
            let meaning = (current.compactMap(\.CoupletSummary).first ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            couplets.append(Couplet(m1: texts[0], m2: texts.count > 1 ? texts[1...].joined(separator: " ") : "", meaning: meaning, ai: !meaning.isEmpty))
            current = []
        }
        let verses = r.Verses.sorted { $0.VOrder < $1.VOrder }
        for v in verses where v.Position != "Paragraph" && v.Position != "Comment" {
            if v.CoupletIndex != currentIndex { flush(); currentIndex = v.CoupletIndex }
            current.append(v)
            if current.count == 2 { flush(); currentIndex = nil }
        }
        flush()
        if couplets.isEmpty {
            // Prose-only page: show paragraphs as single lines.
            couplets = verses.filter { $0.Position == "Paragraph" }.map { Couplet(m1: $0.Text, m2: "", meaning: $0.CoupletSummary ?? "", ai: $0.CoupletSummary != nil) }
        }
        let summary = (r.PoemSummary ?? "").replacingOccurrences(of: "\n", with: " ").replacingOccurrences(of: "  ", with: " ").trimmingCharacters(in: .whitespaces)
        return Poem(url: url, title: r.Title, summary: summary, summaryAI: true, metre: r.Metre?.Rhythm ?? "", rhyme: r.RhymeLetters ?? "",
                    format: "", couplets: couplets, total: couplets.count, reciters: [], songs: [], songCount: 0)
    }
}

struct SearchEntry: Sendable {
    let url: String
    let index: Int
    let text: String
    let meaning: String
}
