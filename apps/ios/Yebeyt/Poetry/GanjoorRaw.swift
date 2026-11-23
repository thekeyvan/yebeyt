import Foundation

// Ganjoor's raw JSON for a poem and a category (github.com/ganjoor/ganjoor-data): the only
// place it is decoded. Mirrors `convert_poem` and `group_couplets` in tools/ganjoor/build.py.

struct RawVerse: Decodable, Sendable {
    var vOrder: Int
    /// GanjoorService's `VersePosition`: Right, Left, CenteredVerse1, CenteredVerse2, Single, Comment, Paragraph.
    var position: String
    var text: String
    var coupletIndex: Int
    var coupletSummary: String?

    enum CodingKeys: String, CodingKey {
        case vOrder = "VOrder", position = "Position", text = "Text"
        case coupletIndex = "CoupletIndex", coupletSummary = "CoupletSummary"
    }
}

struct RawPoem: Decodable, Sendable {
    struct Metre: Decodable, Sendable {
        var rhythm: String?

        enum CodingKeys: String, CodingKey { case rhythm = "Rhythm" }
    }

    var id: Int
    var title: String
    var path: String
    var summary: String?
    var metre: Metre?
    var verses: [RawVerse]

    enum CodingKeys: String, CodingKey {
        case id = "Id", title = "Title", path = "FullUrl", summary = "PoemSummary", metre = "Metre", verses = "Verses"
    }

    func poem() -> Poem {
        Poem(
            id: id, title: title, path: path,
            summary: summary.flatMap { $0.isEmpty ? nil : $0.withoutCarriageReturns },
            rhythm: metre?.rhythm.flatMap { $0.isEmpty ? nil : $0 },
            couplets: Couplet.grouping(verses)
        )
    }
}

struct RawCategory: Decodable, Sendable {
    struct Entry: Decodable, Sendable {
        var id: Int
        var title: String
        var path: String

        enum CodingKeys: String, CodingKey { case id = "Id", title = "Title", path = "FullUrl" }
    }

    var id: Int
    var poetId: Int?
    var title: String
    var path: String
    var toc: String
    var childCats: [Entry]
    var poems: [Entry]

    enum CodingKeys: String, CodingKey {
        case id = "Id", poetId = "PoetId", title = "Title", path = "FullUrl"
        case toc = "TableOfContentsStyle", childCats = "ChildCats", poems = "Poems"
    }

    /// A book with its poem list only; each poem's text comes from `RawPoem`.
    func book() -> Book {
        Book(
            id: id, title: title, path: path, poetId: poetId, toc: toc,
            poems: poems.map { Poem(id: $0.id, title: $0.title, path: $0.path, summary: nil, rhythm: nil, couplets: []) },
            children: childCats.map { BookRef(id: $0.id, title: $0.title, path: $0.path) }
        )
    }
}

extension Couplet {
    /// Verses -> couplets, grouped by `coupletIndex`, in verse order. Left and CenteredVerse2 are
    /// the second hemistich; every other position (Right, Single, Paragraph, ...) goes in the first.
    /// A verse that would fill an occupied slot starts a new couplet.
    static func grouping(_ verses: [RawVerse]) -> [Couplet] {
        var couplets: [Couplet] = []
        var index: Int?
        var hasFirst = false, hasSecond = false
        for verse in verses.sorted(by: { $0.vOrder < $1.vOrder }) {
            let isSecond = verse.position == "Left" || verse.position == "CenteredVerse2"
            if verse.coupletIndex != index || (isSecond ? hasSecond : hasFirst) {
                couplets.append(Couplet(m1: "", m2: ""))
                index = verse.coupletIndex
                hasFirst = false
                hasSecond = false
            }
            let text = verse.text.withoutCarriageReturns
            if isSecond {
                couplets[couplets.count - 1].m2 = text
                hasSecond = true
            } else {
                couplets[couplets.count - 1].m1 = text
                hasFirst = true
            }
            if let meaning = verse.coupletSummary, !meaning.isEmpty, couplets[couplets.count - 1].meaning == nil {
                couplets[couplets.count - 1].meaning = meaning.withoutCarriageReturns
            }
        }
        return couplets
    }
}

private extension String {
    var withoutCarriageReturns: String { replacingOccurrences(of: "\r", with: "") }
}
