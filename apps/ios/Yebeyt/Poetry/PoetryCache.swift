import Foundation

/// Books and poems fetched from the network, kept as JSON files under one folder (Caches, so the
/// system may clear it; the data is fetched again then). Reading and writing are best effort.
struct PoetryCache: Sendable {
    var root: URL

    func read<T: Decodable>(_ type: T.Type, at key: String) -> T? {
        guard let data = try? Data(contentsOf: root.appendingPathComponent(key)) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    func write(_ value: some Encodable, at key: String) {
        let file = root.appendingPathComponent(key)
        try? FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? JSONEncoder().encode(value).write(to: file, options: .atomic)
    }
}
