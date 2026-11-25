import Foundation

/// Where a گوش کن clip of a deck couplet starts and ends, in seconds of recitation `recitation`'s mp3: measured at data-build
/// time (`tools/ganjoor/clips.py`) as the real silence after the first hemistich. Only good for that recitation.
struct ListenRange: Hashable, Sendable, Decodable {
    var recitation: Int
    var start: Double
    var end: Double
}

/// A couplet in a game: from the deck, or from a poem the reader has open.
struct GameCouplet: Hashable, Sendable, Identifiable {
    var poem: String
    /// 0-based, as in the reader.
    var index: Int
    var m1: String
    var m2: String
    /// What the couplet means, when Ganjoor has a note; the after-answer sheet shows it.
    var meaning: String?
    var poetSlug: String
    /// The poet's short name.
    var poetName: String
    var bookTitle: String
    /// The curated book's path (`/moulavi/masnavi`): its title and colour are in library.json. Empty for a couplet of a
    /// poem the reader has open.
    var bookPath = ""
    /// The meaning was written by an AI (no marker is shown yet).
    var meaningIsAI = false
    /// گوش کن, a Hafez couplet of the deck: where its clip really ends (nil: the margin rule of `ListenClipRange` decides).
    var listenRange: ListenRange?

    var id: String { "\(poem)#\(index)" }

    /// «سعدی · گلستان»
    var source: String { bookTitle.isEmpty ? poetName : "\(poetName) · \(bookTitle)" }

    var share: String { ReaderText.shareText(Couplet(m1: m1, m2: m2), poet: poetName, title: bookTitle) }

    /// The AI sparkle shows by the meaning's heading: only when there is a meaning and it was written by an AI.
    var showsAIMark: Bool { meaning != nil && meaningIsAI }

    /// The poet's name when every couplet is by the same poet («۱۰ بیت سعدی»).
    static func singlePoet(of couplets: [GameCouplet]) -> String? {
        Set(couplets.map(\.poetSlug)).count == 1 ? couplets[0].poetName : nil
    }
}

extension GameCouplet {
    /// Couplet `index` of a poem, as a game uses it. (An extension, so the memberwise initialiser stays.)
    init(poem path: String, index: Int, couplet: Couplet, poetSlug: String, poetName: String, bookTitle: String, bookPath: String = "") {
        self.init(
            poem: path, index: index, m1: couplet.m1, m2: couplet.m2, meaning: couplet.meaning, poetSlug: poetSlug, poetName: poetName,
            bookTitle: bookTitle, bookPath: bookPath, meaningIsAI: couplet.ai == true
        )
    }
}

/// The well-known couplets the games draw from: `games.json`, written by `tools/ganjoor/build.py`. It never changes,
/// so it is shared through the environment like the other stores.
final class GameDeck: Observable, Sendable {
    private struct Entry: Decodable {
        var poem: String
        var index: Int
        var m1: String
        var m2: String
        var meaning: String
        var ai: Bool?
        var poet: String
        var book: String?
        var bookTitle: String
        var clip: ListenRange?
    }

    let couplets: [GameCouplet]
    /// The keys of the couplets (`GameCouplet.id`), which are what the server accepts in a challenge.
    let keys: Set<String>

    init(couplets: [GameCouplet]) {
        self.couplets = couplets
        keys = Set(couplets.map(\.id))
    }

    /// Reads games.json from the bundle; throws if it is missing or unreadable. `poetNames` maps a poet's slug to
    /// the short name shown next to the couplet.
    init(bundle: Bundle = .main, poetNames: [String: String]) throws {
        guard let url = bundle.url(forResource: "games", withExtension: "json") else {
            throw PoetryError.missingResource("games")
        }
        let entries = try JSONDecoder().decode([Entry].self, from: Data(contentsOf: url))
        couplets = entries.map {
            GameCouplet(
                poem: $0.poem, index: $0.index, m1: $0.m1, m2: $0.m2, meaning: $0.meaning, poetSlug: $0.poet,
                poetName: poetNames[$0.poet] ?? "", bookTitle: $0.bookTitle, bookPath: $0.book ?? "", meaningIsAI: $0.ai == true,
                listenRange: $0.clip
            )
        }
        keys = Set(couplets.map(\.id))
    }
}
