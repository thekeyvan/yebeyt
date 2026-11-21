import Foundation

struct Couplet: Hashable, Sendable {
    let m1: String
    let m2: String
    let meaning: String
    /// Meaning written with AI help (shown with a small icon).
    let ai: Bool
    var text: String { m2.isEmpty ? m1 : m1 + " " + m2 }
}

struct Song: Hashable, Codable, Sendable {
    let a: String
    let t: String
    let al: String
}

struct Poem: Identifiable, Hashable, Sendable {
    let url: String
    let title: String
    let summary: String
    let summaryAI: Bool
    let metre: String
    let rhyme: String
    let format: String
    let couplets: [Couplet]
    let total: Int
    let reciters: [String]
    let songs: [Song]
    let songCount: Int
    var id: String { url }
    var poet: String { String(url.split(separator: "/").first ?? "") }
    var formatLabel: String { Poem.formats[format] ?? "" }

    static let formats = ["Ghazal": "غزل", "Robaee": "رباعی", "Masnavi": "مثنوی", "Generic": "حکایت", "Dobeyti": "دوبیتی", "Ghete": "قطعه", "Ghaside": "قصیده"]
}

struct Book: Identifiable, Hashable, Sendable {
    let title: String
    let url: String
    let count: Int
    let poet: String
    var id: String { url }
}

struct Poet: Identifiable, Hashable, Sendable {
    let slug: String
    let nick: String
    let fullName: String
    let death: Int
    let birthPlace: String
    let deathPlace: String
    let birth: Int
    let bio: String
    let books: [Book]
    let pin: Int
    var id: String { slug }
    var poemCount: Int { books.reduce(0) { $0 + $1.count } }
    var century: Int { death > 0 ? (death - 1) / 100 + 1 : 0 }
    var hue: Double { hashHue(slug) }
}

/// A single couplet: poem url + couplet index.
struct CoupletRef: Hashable, Codable, Sendable, Identifiable {
    let url: String
    let index: Int
    var key: String { "\(url)#\(index)" }
    var id: String { key }
    init(_ url: String, _ index: Int) { self.url = url; self.index = index }
    init?(key: String) {
        let parts = key.split(separator: "#")
        guard parts.count == 2, let i = Int(parts[1]) else { return nil }
        url = String(parts[0]); index = i
    }
}

struct Mood: Identifiable, Hashable, Sendable {
    let key: String
    let title: String
    let detail: String
    let scene: ArtScene
    let hue: Double
    let items: [CoupletRef]
    var id: String { key }
}

/// A category from the full Ganjoor data (a book or a part of one).
struct CategoryPage: Sendable {
    struct Item: Hashable, Sendable, Identifiable {
        let title: String
        let url: String
        let excerpt: String
        var id: String { url }
    }
    let title: String
    let children: [Item]
    let poems: [Item]
}

// MARK: - Bundled JSON shape

struct RawPoem: Decodable {
    let u: String
    let t: String
    let s: String
    let sa: Int
    let me: String
    let r: String
    let f: String
    let c: [[RawValue]]
    let tot: Int?
    let rec: [String]?
    let so: [Song]?
    let ns: Int?

    enum RawValue: Decodable {
        case s(String), i(Int)
        init(from d: Decoder) throws {
            let c = try d.singleValueContainer()
            if let v = try? c.decode(String.self) { self = .s(v) } else { self = .i(try c.decode(Int.self)) }
        }
        var string: String { if case .s(let v) = self { return v }; return "" }
        var int: Int { if case .i(let v) = self { return v }; return 0 }
    }

    var poem: Poem {
        Poem(url: u, title: t, summary: s, summaryAI: sa == 1, metre: me, rhyme: r, format: f,
             couplets: c.map { Couplet(m1: $0[0].string, m2: $0[1].string, meaning: $0[2].string, ai: $0.count > 3 && $0[3].int == 1) },
             total: tot ?? c.count, reciters: rec ?? [], songs: so ?? [], songCount: ns ?? 0)
    }
}

struct RawPoet: Decodable {
    struct B: Decodable { let t: String; let u: String; let n: Int }
    let s: String, n: String, f: String, d: Int, bp: String, dp: String, by: Int, bio: String, b: [B], pin: Int
    var poet: Poet {
        Poet(slug: s, nick: n, fullName: f, death: d, birthPlace: bp, deathPlace: dp, birth: by, bio: bio,
             books: b.map { Book(title: $0.t, url: $0.u, count: $0.n, poet: s) }, pin: pin)
    }
}
