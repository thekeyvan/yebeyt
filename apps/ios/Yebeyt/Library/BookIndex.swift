import Foundation

/// One poem of a book as listed in `index-<catId>.json`: enough for a list row, without loading the poem.
struct IndexedPoem: Hashable, Sendable, Identifiable {
    var id: Int
    /// The category (section) the poem sits directly in.
    var catId: Int
    /// The full Ganjoor path, e.g. `/hafez/ghazal/sh3`.
    var path: String
    /// The first hemistich.
    var first: String
    var couplets: Int
    /// Ganjoor's rhyme letters, e.g. «لها».
    var rhyme: String
    /// How many recitations Ganjoor has: the popularity.
    var recitations: Int
    /// The 1-based place among the poems of its category, in the book's order.
    var number: Int
}

/// The poems of one book, in the book's order.
struct BookIndex: Sendable {
    var poems: [IndexedPoem]

    /// The poems sitting directly in one category.
    func poems(in catId: Int) -> [IndexedPoem] {
        poems.filter { $0.catId == catId }
    }

    /// The poems of a category and everything below it.
    func poems(inAny catIds: Set<Int>) -> [IndexedPoem] {
        poems.filter { catIds.contains($0.catId) }
    }

    func poem(path: String) -> IndexedPoem? {
        poems.first { $0.path == path }
    }
}

extension BookIndex {
    private struct File: Decodable {
        var poems: [Row]
    }

    /// `[id, catId, slug, first, couplets, rhyme, recitations]`.
    private struct Row: Decodable {
        var id: Int, catId: Int, slug: String, first: String, couplets: Int, rhyme: String, recitations: Int

        init(from decoder: any Decoder) throws {
            var values = try decoder.unkeyedContainer()
            id = try values.decode(Int.self)
            catId = try values.decode(Int.self)
            slug = try values.decode(String.self)
            first = try values.decode(String.self)
            couplets = try values.decode(Int.self)
            rhyme = try values.decode(String.self)
            recitations = try values.decode(Int.self)
        }
    }

    /// Reads an index file; `book` supplies the category paths the poem paths are built from.
    init(data: Data, book: LibraryBook) throws {
        let rows = try JSONDecoder().decode(File.self, from: data).poems
        var paths: [Int: String] = [:]
        func collect(_ section: BookSection) {
            paths[section.id] = section.path
            section.children.forEach(collect)
        }
        collect(book.asSection)
        var counts: [Int: Int] = [:]
        poems = rows.compactMap { row in
            guard let base = paths[row.catId] else { return nil }
            counts[row.catId, default: 0] += 1
            return IndexedPoem(
                id: row.id, catId: row.catId, path: "\(base)/\(row.slug)", first: row.first, couplets: row.couplets,
                rhyme: row.rhyme, recitations: row.recitations, number: counts[row.catId] ?? 0
            )
        }
    }
}
