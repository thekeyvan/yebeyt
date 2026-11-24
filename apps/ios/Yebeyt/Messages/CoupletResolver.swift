import Foundation
import Observation

/// A couplet found by its key: the text and the words around it.
struct ResolvedCouplet: Equatable, Identifiable, Sendable {
    let key: String
    let path: String
    /// 0-based, as in the reader.
    let index: Int
    let couplet: Couplet
    let poetSlug: String
    /// The poet's short name.
    let poetName: String
    /// «غزل ۳»
    let title: String

    var id: String { key }

    /// «حافظ · غزل ۳»
    var source: String { "\(poetName) · \(title)" }

    /// What the long-press menu lifts.
    var held: HeldCouplet {
        HeldCouplet(
            path: path, index: index, couplet: couplet, caption: ReaderText.caption(poet: poetName, title: title, index: index),
            shareText: ReaderText.shareText(couplet, poet: poetName, title: title), copyText: ReaderText.copyText(couplet, poet: poetName)
        )
    }
}

/// Finds the couplets that messages and shared divans name by key. The server holds no poem text: the phone reads
/// the poem (bundled, or cached once read) and keeps what it found.
@MainActor @Observable
final class CoupletResolver {
    @ObservationIgnored private let store: PoetryStore
    @ObservationIgnored private var found: [String: ResolvedCouplet] = [:]

    init(store: PoetryStore) {
        self.store = store
    }

    /// The couplet already found, without waiting.
    func cached(_ key: String) -> ResolvedCouplet? { found[key] }

    /// Nil when the key is not a couplet of a poem the phone can load (no network and not cached).
    func resolve(_ key: String) async -> ResolvedCouplet? {
        if let known = found[key] { return known }
        guard let (path, index) = CoupletKey.parse(key) else { return nil }
        guard let poem = try? await store.poem(path: path), poem.couplets.indices.contains(index) else { return nil }
        let poet = store.poets.first { path.hasPrefix("/\($0.slug)/") }
        let resolved = ResolvedCouplet(
            key: key, path: path, index: index, couplet: poem.couplets[index], poetSlug: poet?.slug ?? "",
            poetName: poet?.nickname ?? "", title: ReaderText.shortTitle(poem.title)
        )
        found[key] = resolved
        return resolved
    }
}
