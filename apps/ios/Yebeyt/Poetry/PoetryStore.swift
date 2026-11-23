import Foundation
import Observation

/// Poets, books and poems. The poets and a few whole books are bundled; everything else is
/// fetched from ganjoor-data at the pinned commit and cached on the phone, so it works offline
/// after the first load. Network failures are thrown (`URLError`, `PoetryError`, `DecodingError`).
@MainActor @Observable
final class PoetryStore {
    private static let dataURL = URL(string: "https://raw.githubusercontent.com/ganjoor/ganjoor-data")!
    private static let recitationsURL = URL(string: "https://api.ganjoor.net/api/ganjoor/poem")!

    static var defaultCacheDirectory: URL {
        URL.cachesDirectory.appendingPathComponent("poetry", isDirectory: true)
    }

    private(set) var poets: [Poet]
    /// The ganjoor-data commit all data comes from.
    let sha: String

    @ObservationIgnored private let bundle: Bundle
    @ObservationIgnored private let session: URLSession
    @ObservationIgnored private let cache: PoetryCache
    @ObservationIgnored private let booksById: [Int: BookRef]
    @ObservationIgnored private var bundledBooks: [Int: BundledBook] = [:]

    /// Loads poets.json from the bundle; throws if it is missing or unreadable.
    init(bundle: Bundle = .main, session: URLSession = .shared, cacheDirectory: URL = PoetryStore.defaultCacheDirectory) throws {
        let file = try BundledPoetry.poets(in: bundle)
        self.bundle = bundle
        self.session = session
        poets = file.poets
        sha = file.source.sha
        cache = PoetryCache(root: cacheDirectory.appendingPathComponent(file.source.sha, isDirectory: true))
        booksById = Dictionary(file.poets.flatMap(\.books).map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    /// A poet's book by id (the ids in `Poet.books`).
    func book(id: Int) async throws -> Book {
        guard let ref = booksById[id] else { throw PoetryError.notFound("book \(id)") }
        return try await book(path: ref.path)
    }

    /// Any book by Ganjoor path, such as `/hafez/ghazal` or a sub-book from `Book.children`.
    func book(path: String) async throws -> Book {
        if let ref = booksById.values.first(where: { $0.isBundled && $0.path == path }) {
            return try await bundledBook(id: ref.id).book
        }
        return try await cachedOrFetched(path: path, key: "poets\(path)/_cat.json") { (raw: RawCategory) in raw.book() }
    }

    /// A poem by Ganjoor path, such as `/hafez/ghazal/sh3`, with all its couplets.
    func poem(path: String) async throws -> Poem {
        if let ref = booksById.values.first(where: { $0.isBundled && path.hasPrefix($0.path + "/") }),
           let poem = try await bundledBook(id: ref.id).poems.first(where: { $0.path == path }) {
            return poem
        }
        return try await cachedOrFetched(path: path, key: "poets\(path).json") { (raw: RawPoem) in raw.poem() }
    }

    /// The recitations of a poem from Ganjoor's API (always live, not cached), in Ganjoor's order.
    func recitations(poemId: Int) async throws -> [Recitation] {
        let url = Self.recitationsURL.appendingPathComponent("\(poemId)/recitations")
        let list = try await fetch([Recitation].self, from: url, what: "recitations of poem \(poemId)")
        return list.sorted { $0.audioOrder < $1.audioOrder }
    }

    private func bundledBook(id: Int) async throws -> BundledBook {
        if let book = bundledBooks[id] { return book }
        let bundle = bundle
        let book = try await Task.detached { try BundledPoetry.book(id: id, in: bundle) }.value
        bundledBooks[id] = book
        return book
    }

    /// The cached value if there is one; otherwise the file at `key` in ganjoor-data, converted and cached.
    private func cachedOrFetched<Raw: Decodable, Value: Codable>(
        path: String, key: String, convert: (Raw) -> Value
    ) async throws -> Value {
        guard Self.isValid(path: path) else { throw PoetryError.notFound(path) }
        if let cached = cache.read(Value.self, at: key) { return cached }
        let url = Self.dataURL.appendingPathComponent(sha).appendingPathComponent(key)
        let value = convert(try await fetch(Raw.self, from: url, what: path))
        cache.write(value, at: key)
        return value
    }

    private func fetch<T: Decodable>(_ type: T.Type, from url: URL, what: String) async throws -> T {
        let (data, response) = try await session.data(from: url)
        if let status = (response as? HTTPURLResponse)?.statusCode, status != 200 {
            throw status == 404 ? PoetryError.notFound(what) : PoetryError.badStatus(status)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// Paths look like `/poet/book/poem`; anything else could point outside the cache folder.
    private static func isValid(path: String) -> Bool {
        path.hasPrefix("/") && !path.split(separator: "/", omittingEmptySubsequences: false).dropFirst()
            .contains { $0.isEmpty || $0 == "." || $0 == ".." }
    }
}
