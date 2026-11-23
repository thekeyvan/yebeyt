import Foundation

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
    /// The meaning was written by an AI (no marker is shown yet).
    var meaningIsAI = false

    var id: String { "\(poem)#\(index)" }

    /// «سعدی · گلستان»
    var source: String { bookTitle.isEmpty ? poetName : "\(poetName) · \(bookTitle)" }

    var share: String { ReaderText.shareText(Couplet(m1: m1, m2: m2), poet: poetName, title: bookTitle) }
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
        var bookTitle: String
    }

    let couplets: [GameCouplet]

    init(couplets: [GameCouplet]) {
        self.couplets = couplets
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
                poetName: poetNames[$0.poet] ?? "", bookTitle: $0.bookTitle, meaningIsAI: $0.ai == true
            )
        }
    }
}
