import Foundation

/// A poet, as written by `tools/ganjoor/build.py` into poets.json. Years are lunar Hijri.
struct Poet: Codable, Hashable, Sendable, Identifiable {
    var id: Int
    var slug: String
    /// The short display name; `name` is the full name for the poet's own page.
    var nickname: String
    var name: String
    var bio: String
    var birthYear: Int?
    var deathYear: Int?
    var books: [BookRef]
}

/// A book (a category in Ganjoor) as listed under a poet or inside another book.
struct BookRef: Codable, Hashable, Sendable, Identifiable {
    var id: Int
    var title: String
    /// Ganjoor's path, e.g. `/hafez/ghazal`.
    var path: String
    /// True when the whole book text is bundled in the app.
    var bundled: Bool?

    var isBundled: Bool { bundled == true }
}

struct Book: Codable, Hashable, Sendable, Identifiable {
    var id: Int
    var title: String
    var path: String
    var poetId: Int?
    /// Ganjoor's table-of-contents style, e.g. `AlphabeticWithFirstVerse`.
    var toc: String
    /// The poems in order. Open one with `PoetryStore.poem(path:)`.
    var poems: [PoemRef]
    /// Sub-books. Bundled books have none.
    var children: [BookRef]

    enum CodingKeys: String, CodingKey { case id, title, path, poetId, toc, poems, children }

    init(id: Int, title: String, path: String, poetId: Int?, toc: String, poems: [PoemRef], children: [BookRef] = []) {
        self.id = id
        self.title = title
        self.path = path
        self.poetId = poetId
        self.toc = toc
        self.poems = poems
        self.children = children
    }

    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try values.decode(Int.self, forKey: .id),
            title: try values.decode(String.self, forKey: .title),
            path: try values.decode(String.self, forKey: .path),
            poetId: try values.decodeIfPresent(Int.self, forKey: .poetId),
            toc: try values.decode(String.self, forKey: .toc),
            poems: try values.decode([PoemRef].self, forKey: .poems),
            children: try values.decodeIfPresent([BookRef].self, forKey: .children) ?? []
        )
    }
}

/// A poem as listed in a book.
struct PoemRef: Codable, Hashable, Sendable, Identifiable {
    var id: Int
    var title: String
    var path: String
}

/// A poem of a bundled book with its poet's slug.
struct BundledPoem: Sendable {
    var slug: String
    var poem: Poem
}

/// A bundled book file: the book with the full text of every poem.
struct BundledBook: Decodable, Sendable {
    var book: Book
    var poems: [Poem]

    init(from decoder: any Decoder) throws {
        // The poems array holds full poems; `Book` reads just their id, title and path.
        book = try Book(from: decoder)
        poems = try decoder.container(keyedBy: Book.CodingKeys.self).decode([Poem].self, forKey: .poems)
    }
}

struct Poem: Codable, Hashable, Sendable, Identifiable {
    var id: Int
    var title: String
    var path: String
    var summary: String?
    /// True when `summary` was written by an AI (Ganjoor's «هوش مصنوعی:» label, stripped from the text).
    var summaryAi: Bool?
    var rhythm: String?
    var couplets: [Couplet]
}

/// One couplet: two hemistichs, or for prose and free verse one line in `m1` with `m2` empty.
struct Couplet: Codable, Hashable, Sendable {
    var m1: String
    var m2: String
    /// What the couplet means, when Ganjoor has a note for it.
    var meaning: String?
    /// True when the meaning was written by an AI (Ganjoor's «هوش مصنوعی:» label, stripped from the text).
    var ai: Bool?

    init(m1: String, m2: String, meaning: String? = nil, ai: Bool? = nil) {
        self.m1 = m1
        self.m2 = m2
        self.meaning = meaning
        self.ai = ai
    }
}
