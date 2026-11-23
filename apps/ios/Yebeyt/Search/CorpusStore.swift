import Foundation
import Observation

/// Loads the couplet corpus once, the first time a screen needs it (search, a mood, the home couplet).
@MainActor @Observable
final class CorpusStore {
    @ObservationIgnored private var task: Task<CoupletCorpus?, Never>?

    func corpus(poetry: PoetryStore, library: Library) async -> CoupletCorpus? {
        if let task { return await task.value }
        let task = Task { () -> CoupletCorpus? in
            guard let poems = try? await poetry.bundledPoems() else { return nil }
            var popularity: [String: Int] = [:]
            for row in await library.indexedPoems(coveringAny: poetry.bundledPaths) { popularity[row.path] = row.recitations }
            return await Task.detached { CoupletCorpus(poems: poems, popularity: popularity) }.value
        }
        self.task = task
        let result = await task.value
        if result == nil { self.task = nil }  // a failed load may be tried again
        return result
    }
}
