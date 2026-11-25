import Foundation

/// Finds what گوش کن plays: for a couplet of a Hafez poem, the first recitation that is in sync with the text and the
/// seconds its first hemistich is read: as measured at data-build time when the deck has it for that recitation, else
/// from the timing file (`ListenClipRange` stops it before the next hemistich).
/// Ganjoor is asked at the start of the round; the three calls are given as closures so tests can stub them.
struct ListenLoader: Sendable {
    var poem: @Sendable (String) async throws -> Poem
    var recitations: @Sendable (Int) async throws -> [Recitation]
    var timing: @Sendable (URL) async throws -> Data

    /// Poems tried at once; more are tried only when these did not give enough questions.
    private static let batch = 6

    /// The clip of a couplet; nil when the poem has no recitation in sync, or anything could not be loaded. A deck couplet
    /// that was measured against this very recitation plays as measured (`listenRange`); any other gets the margin rule.
    func clip(for couplet: GameCouplet) async -> ListenClip? {
        guard let poem = try? await poem(couplet.poem), let list = try? await recitations(poem.id),
              let recitation = list.first(where: { $0.inSyncWithText && $0.xmlUrl != nil }), let xml = recitation.xmlUrl else { return nil }
        if let measured = couplet.listenRange, measured.recitation == recitation.id {
            return ListenClip(audio: recitation.mp3Url, start: measured.start, end: measured.end)
        }
        guard let data = try? await timing(xml), let timing = try? RecitationTiming(xml: data),
              let range = timing.firstHemistich(ofCouplet: couplet.index, in: poem.couplets) else { return nil }
        return ListenClip(
            audio: recitation.mp3Url, start: range.lowerBound, end: ListenClipRange.end(start: range.lowerBound, nextMark: range.upperBound)
        )
    }

    /// Up to `count` questions from the Hafez couplets of the deck, one for each poem that has a clip.
    func questions(deck: GameDeck, count: Int, generator: inout SeededGenerator) async -> [QuizQuestion] {
        let hafez = deck.couplets.filter { $0.poetSlug == "hafez" }
        var seenPoems = Set<String>()
        let candidates = generator.shuffled(hafez).filter { seenPoems.insert($0.poem).inserted }
        var questions: [QuizQuestion] = []
        var next = 0
        while questions.count < count, next < candidates.count {
            let group = Array(candidates[next..<min(next + Self.batch, candidates.count)])
            next += group.count
            let clips = await withTaskGroup(of: (Int, ListenClip?).self) { tasks in
                for (offset, couplet) in group.enumerated() { tasks.addTask { (offset, await clip(for: couplet)) } }
                var found: [Int: ListenClip] = [:]
                for await (offset, clip) in tasks { if let clip { found[offset] = clip } }
                return found
            }
            for offset in group.indices.sorted() where questions.count < count {
                guard let clip = clips[offset], let question = QuizMaker.listen(group[offset], pool: hafez, clip: clip, generator: &generator) else { continue }
                questions.append(question)
            }
        }
        return questions
    }
}

extension ListenLoader {
    /// Ganjoor's real answers: the poem from the store, its recitations from the API, the timing file from its URL.
    @MainActor static func live(store: PoetryStore) -> ListenLoader {
        ListenLoader(
            poem: { try await store.poem(path: $0) }, recitations: { try await store.recitations(poemId: $0) },
            timing: { try await URLSession.shared.data(from: $0).0 }
        )
    }
}
