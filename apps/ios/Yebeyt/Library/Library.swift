import Foundation
import Observation

enum LibraryError: Error, Equatable {
    case missingResource(String)
}

/// The curated library: poets, books, moods (library.json) and the poem index of each book, loaded when
/// the book is first opened.
@MainActor @Observable
final class Library {
    let poets: [LibraryPoet]
    let books: [LibraryBook]
    let moods: [Mood]
    /// The poets of the Explore row, in order.
    let explorePoets: [LibraryPoet]

    @ObservationIgnored private let bundle: Bundle
    @ObservationIgnored private var indexes: [Int: BookIndex] = [:]

    /// Loads library.json from the bundle; throws if it is missing or unreadable.
    init(bundle: Bundle = .main) throws {
        guard let url = bundle.url(forResource: "library", withExtension: "json") else {
            throw LibraryError.missingResource("library")
        }
        let file = try JSONDecoder().decode(LibraryFile.self, from: Data(contentsOf: url))
        self.bundle = bundle
        poets = file.poets
        books = file.books
        moods = file.moods
        explorePoets = file.explorePoets.compactMap { slug in file.poets.first { $0.slug == slug } }
    }

    /// How many poets have a book: «۹۹ کتاب از ۴۸ شاعر».
    var poetCount: Int { Set(books.map(\.poet)).count }

    func poet(slug: String) -> LibraryPoet? { poets.first { $0.slug == slug } }

    func poet(of book: LibraryBook) -> LibraryPoet? { poet(slug: book.poet) }

    func book(id: Int) -> LibraryBook? { books.first { $0.id == id } }

    func book(path: String) -> LibraryBook? { books.first { $0.path == path } }

    func books(of poet: String) -> [LibraryBook] { books.filter { $0.poet == poet } }

    /// The book a poem path belongs to; the longest book path wins when books nest.
    func book(containing poemPath: String) -> LibraryBook? {
        books.filter { poemPath.hasPrefix($0.path + "/") }.max { $0.path.count < $1.path.count }
    }

    /// The book and the section at a Ganjoor path, e.g. `/hafez/ghazal`.
    func section(path: String) -> (book: LibraryBook, section: BookSection)? {
        for book in books.sorted(by: { $0.path.count > $1.path.count }) where path == book.path || path.hasPrefix(book.path + "/") {
            if let section = book.section(path: path) { return (book, section) }
        }
        return nil
    }

    /// The poet's main book: the first divan, else the first book.
    func mainBook(of poet: String) -> LibraryBook? {
        let own = books(of: poet)
        return own.first { $0.type == .divan } ?? own.first
    }

    /// The poems of the books that hold any of these paths (the bundled books), from their indexes.
    func indexedPoems(coveringAny paths: [String]) async -> [IndexedPoem] {
        var result: [IndexedPoem] = []
        for book in books where paths.contains(where: { $0 == book.path || $0.hasPrefix(book.path + "/") }) {
            if let index = try? await index(of: book) {
                result += index.poems.filter { poem in paths.contains { poem.path.hasPrefix($0 + "/") } }
            }
        }
        return result
    }

    /// The poem index of a book (cached after the first load).
    func index(of book: LibraryBook) async throws -> BookIndex {
        if let cached = indexes[book.id] { return cached }
        guard let url = bundle.url(forResource: "index-\(book.id)", withExtension: "json") else {
            throw LibraryError.missingResource("index-\(book.id)")
        }
        let index = try await Task.detached { try BookIndex(data: Data(contentsOf: url), book: book) }.value
        indexes[book.id] = index
        return index
    }
}
