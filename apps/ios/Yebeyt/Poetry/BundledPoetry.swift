import Foundation

enum PoetryError: Error, Equatable {
    /// A bundled data file is missing from the app (a packaging bug).
    case missingResource(String)
    /// No such poem, book or poet.
    case notFound(String)
    /// Ganjoor's server answered with this HTTP status.
    case badStatus(Int)
}

/// poets.json: the poets and where the data comes from.
struct PoetsFile: Decodable, Sendable {
    struct Source: Decodable, Sendable {
        var repo: String
        /// The ganjoor-data commit the bundled files were built from; also used for fetching more.
        var sha: String
    }

    var source: Source
    var poets: [Poet]
}

/// The files `tools/ganjoor/build.py` wrote into the app.
enum BundledPoetry {
    static func poets(in bundle: Bundle = .main) throws -> PoetsFile {
        try decode(PoetsFile.self, resource: "poets", in: bundle)
    }

    static func book(id: Int, in bundle: Bundle = .main) throws -> BundledBook {
        try decode(BundledBook.self, resource: "book-\(id)", in: bundle)
    }

    private static func decode<T: Decodable>(_ type: T.Type, resource: String, in bundle: Bundle) throws -> T {
        guard let url = bundle.url(forResource: resource, withExtension: "json") else {
            throw PoetryError.missingResource(resource)
        }
        return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
    }
}
