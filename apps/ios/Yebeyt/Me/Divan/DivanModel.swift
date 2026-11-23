import Foundation
import Observation

/// The kept couplets of the divan as entries: the text comes from the poems (bundled or cached once read), so
/// a couplet whose poem can't be loaded is left out of the lists (it stays kept).
@MainActor @Observable
final class DivanModel {
    private(set) var entries: [DivanEntry] = []
    private(set) var isLoading = true

    /// Builds the entries for `items` (the kept ones, as `ReaderMarks.keptItems`).
    func load(_ items: [DivanItem], using store: PoetryStore) async {
        var poems: [String: Poem] = [:]
        var failed: Set<String> = []
        var built: [DivanEntry] = []
        for item in items {
            guard let hash = item.key.lastIndex(of: "#"), let index = Int(item.key[item.key.index(after: hash)...]) else { continue }
            let path = String(item.key[..<hash])
            if poems[path] == nil, !failed.contains(path) {
                do { poems[path] = try await store.poem(path: path) } catch { failed.insert(path) }
            }
            guard let poem = poems[path], poem.couplets.indices.contains(index) else { continue }
            built.append(DivanEntry(
                key: item.key, path: path, index: index, couplet: poem.couplets[index],
                poetSlug: path.split(separator: "/").first.map(String.init) ?? "", title: ReaderText.shortTitle(poem.title), keptAt: item.keptAt ?? 0
            ))
        }
        entries = built.sorted { ($0.keptAt, $1.key) > ($1.keptAt, $0.key) }
        isLoading = false
    }
}
