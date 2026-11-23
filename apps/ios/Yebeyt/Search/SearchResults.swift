import Foundation

/// What a search finds: the poets and books by name here, the couplets in the bundled books.
struct SearchResults: Sendable {
    var poets: [LibraryPoet] = []
    var books: [LibraryBook] = []
    var couplets: [CoupletEntry] = []

    var isEmpty: Bool { poets.isEmpty && books.isEmpty && couplets.isEmpty }
    static let coupletLimit = 30
}

extension Library {
    /// Poets and books whose names contain the query (a book also by its poet's name).
    func find(_ query: String) -> SearchResults {
        guard !TextNormalizer.normalize(query).isEmpty else { return SearchResults() }
        let poets = poets.filter { TextNormalizer.contains($0.name, query: query) }
        let books = books.filter { book in
            TextNormalizer.contains(book.title, query: query) || poet(of: book).map { TextNormalizer.contains($0.name, query: query) } == true
        }
        return SearchResults(poets: poets, books: books)
    }

    /// Everything the query finds; couplets come from `corpus`, when it has loaded.
    func search(_ query: String, corpus: CoupletCorpus?) -> SearchResults {
        var results = find(query)
        results.couplets = corpus?.search(query, limit: SearchResults.coupletLimit) ?? []
        return results
    }
}
