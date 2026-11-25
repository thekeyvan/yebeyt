import Foundation
import AVFoundation
import Testing
@testable import Yebeyt

struct ListenTimingTests {
    private let ghazal = (0..<4).map { Couplet(m1: "الف\($0)", m2: "ب\($0)") }

    private func timing() throws -> RecitationTiming {
        try RecitationTiming(xml: Fixtures.data("timing-2130-ff", extension: "xml"))
    }

    @Test func theFirstHemistichRunsFromItsVerseToTheStartOfTheNext() throws {
        let timing = try timing()
        #expect(timing.firstHemistich(ofCouplet: 0, in: ghazal) == 0...7.386)
        #expect(timing.firstHemistich(ofCouplet: 1, in: ghazal) == 15.486...21.036)
        #expect(timing.firstHemistich(ofCouplet: 2, in: ghazal) == 29.886...34.986)
    }

    @Test func aSingleLineCoupletBeforeItShiftsTheVerses() throws {
        let mixed = [Couplet(m1: "نثر", m2: ""), Couplet(m1: "الف", m2: "ب"), Couplet(m1: "پ", m2: "ت")]
        let timing = try timing()
        #expect(timing.firstHemistich(ofCouplet: 1, in: mixed) == 7.386...15.486)
        #expect(timing.firstHemistich(ofCouplet: 2, in: mixed) == 21.036...29.886)
        #expect(timing.firstHemistich(ofCouplet: 0, in: mixed) == nil, "a single line has no second hemistich to guess")
    }

    @Test func aCoupletWhoseSecondVerseIsNotTimedOrThatIsNotThereHasNoRange() throws {
        let timing = try timing()
        #expect(timing.firstHemistich(ofCouplet: 3, in: ghazal) == nil)
        #expect(timing.firstHemistich(ofCouplet: 9, in: ghazal) == nil)
        #expect(timing.firstHemistich(ofCouplet: -1, in: ghazal) == nil)
    }
}

struct ListenLoaderTests {
    /// What the stubbed Ganjoor answers for a poem: its recitations, and every timing file is the fixture.
    private func loader(
        recited: @escaping @Sendable (Int) -> Bool = { _ in true }, timing: Data? = nil, failing: Bool = false,
        couplets: [Couplet] = (0..<3).map { Couplet(m1: "الف\($0)", m2: "ب\($0)") }
    ) throws -> ListenLoader {
        let recitations = try JSONDecoder().decode([Recitation].self, from: Fixtures.data("recitations")).sorted { $0.audioOrder < $1.audioOrder }
        let xml = try timing ?? Fixtures.data("timing-2130-ff", extension: "xml")
        return ListenLoader(
            poem: { path in
                if failing { throw URLError(.notConnectedToInternet) }
                return Poem(id: Int(path.split(separator: "p").last ?? "0") ?? 0, title: "", path: path, couplets: couplets)
            },
            recitations: { id in
                if failing { throw URLError(.notConnectedToInternet) }
                return recited(id) ? recitations : []
            },
            timing: { _ in xml }
        )
    }

    private func hafez(_ poem: Int, index: Int = 0) -> GameCouplet {
        var couplet = QuizFixtures.couplets(poet: "hafez", count: 1)[0]
        couplet.poem = "/hafez/p\(poem)"
        couplet.index = index
        couplet.m2 = "مصراع دوم \(poem) \(index) گوهر\(QuizFixtures.ends[(poem + index) % QuizFixtures.ends.count])"
        return couplet
    }

    private func deck(poems: Int = 14) -> GameDeck {
        GameDeck(couplets: (0..<poems).flatMap { poem in (0..<3).map { hafez(poem, index: $0) } } + QuizFixtures.couplets(poet: "saadi", count: 30))
    }

    @Test func theClipIsTheFirstRecitationInSyncAndTheFirstHemistichUpToTheMargin() async throws {
        let clip = try #require(await loader().clip(for: hafez(1, index: 1)))
        #expect(clip.audio == URL(string: "https://i.ganjoor.net/a/2132-ff.mp3")!)
        #expect(clip.start == 15.486)
        #expect(abs(clip.end - (21.036 - ListenClipRange.margin)) < 0.0001, "it stops before the next hemistich's mark, not at it")
    }

    @Test func aLastOrSingleLineCoupletHasNoClip() async throws {
        // Four couplets are timed up to the last verse, which has no mark after it; a single line has no second hemistich.
        let couplets = [Couplet(m1: "نثر", m2: ""), Couplet(m1: "الف", m2: "ب"), Couplet(m1: "پ", m2: "ت"), Couplet(m1: "ث", m2: "ج")]
        let loader = try loader(couplets: couplets)
        #expect(await loader.clip(for: hafez(1, index: 0)) == nil, "a single line")
        #expect(await loader.clip(for: hafez(1, index: 1)) != nil)
        #expect(await loader.clip(for: hafez(1, index: 3)) == nil, "no mark for the verse after the last")
    }

    @Test func noRecitationInSyncOrNoTimingMeansNoClip() async throws {
        #expect(await (try loader(recited: { _ in false })).clip(for: hafez(1)) == nil)
        #expect(await (try loader(timing: Data("<nope/>".utf8))).clip(for: hafez(1)) == nil)
        #expect(await (try loader(failing: true)).clip(for: hafez(1)) == nil)
        #expect(await (try loader()).clip(for: hafez(1, index: 5)) == nil, "the couplet is not in the poem")
    }

    @Test func aRecitationWithoutATimingFileIsSkipped() async throws {
        let unsynced = try JSONDecoder().decode([Recitation].self, from: Fixtures.data("recitations")).filter { !$0.inSyncWithText }
        let loader = ListenLoader(poem: { _ in Poem(id: 1, title: "", path: "/hafez/p1", couplets: [Couplet(m1: "الف", m2: "ب")]) }, recitations: { _ in unsynced }, timing: { _ in Data() })
        #expect(await loader.clip(for: hafez(1)) == nil)
    }

    @Test func fiveQuestionsFromHafezPoemsThatHaveARecitation() async throws {
        let deck = deck()
        var generator = SeededGenerator(seed: 2)
        let questions = await (try loader(recited: { $0 % 2 == 0 })).questions(deck: deck, count: 5, generator: &generator)
        #expect(questions.count == 5)
        #expect(questions.allSatisfy { $0.kind == .listen && $0.clip != nil && $0.options.count == 3 && $0.couplet.poetSlug == "hafez" })
        #expect(Set(questions.map(\.couplet.poem)).count == 5, "one question for each poem")
        #expect(questions.allSatisfy { (Int($0.couplet.poem.split(separator: "p").last ?? "") ?? 1) % 2 == 0 })
        for question in questions {
            #expect(question.options[question.correct].title == TextNormalizer.plain(question.couplet.m2))
            #expect(question.options.allSatisfy { option in deck.couplets.first { $0.id == option.id }?.poetSlug == "hafez" })
        }
    }

    @Test func fewerQuestionsWhenFewPoemsAreRecited() async throws {
        var generator = SeededGenerator(seed: 2)
        let questions = await (try loader(recited: { $0 < 2 })).questions(deck: deck(), count: 5, generator: &generator)
        #expect(questions.count == 2)
    }

    @Test func nothingWhenNoRecitationCanBeLoaded() async throws {
        var generator = SeededGenerator(seed: 2)
        #expect(await (try loader(failing: true)).questions(deck: deck(), count: 5, generator: &generator).isEmpty)
        #expect(await (try loader(recited: { _ in false })).questions(deck: deck(), count: 5, generator: &generator).isEmpty)
    }

    @Test func theSameSeedGivesTheSameQuestions() async throws {
        var first = SeededGenerator(seed: 8), second = SeededGenerator(seed: 8)
        let loader = try loader()
        #expect(await loader.questions(deck: deck(), count: 5, generator: &first) == loader.questions(deck: deck(), count: 5, generator: &second))
    }

    @Test func theWordHintPointsAtAWordOfTheRightOption() async throws {
        var generator = SeededGenerator(seed: 2)
        let questions = await (try loader()).questions(deck: deck(), count: 5, generator: &generator)
        for question in questions {
            let words = question.options[question.correct].title.split(whereSeparator: \.isWhitespace)
            let index = try #require(question.hintWord)
            #expect(words.indices.contains(index))
        }
    }
}

struct ListenClipRangeTests {
    @Test func theClipEndsTheMarginBeforeTheNextHemistich() {
        #expect(abs(ListenClipRange.end(start: 15.486, nextMark: 21.036) - 20.236) < 0.0001)
        #expect(abs(ListenClipRange.end(start: 0, nextMark: 7.386) - 6.586) < 0.0001)
    }

    @Test func aShortHemistichKeepsTheMinimumLength() {
        #expect(ListenClipRange.end(start: 10, nextMark: 12.0) == 11.2, "2 s − 0.8 s is 1.2 s: just the minimum")
        #expect(abs(ListenClipRange.end(start: 10, nextMark: 11.5) - 11.2) < 0.0001, "1.5 s − 0.8 s would be 0.7 s")
    }

    @Test func theClipNeverRunsPastTheMarkEvenWhenTheHemistichIsShorterThanTheMinimum() {
        #expect(ListenClipRange.end(start: 10, nextMark: 10.9) == 10.9)
    }

    @Test func theFadeIsTheLastQuarterSecond() {
        let range = ListenClipRange.fadeRange(start: 15.486, end: 20.236)
        #expect(abs(range.lowerBound - 19.986) < 0.0001)
        #expect(range.upperBound == 20.236)
        #expect(ListenClipRange.fade == 0.25)
    }

    @Test func theFadeNeverStartsBeforeTheClip() {
        #expect(ListenClipRange.fadeRange(start: 10, end: 10.1) == 10...10.1)
    }

    @Test func theMixRampsTheVolumeFromFullToNothingOverTheFade() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("listen-\(UUID().uuidString).caf")
        defer { try? FileManager.default.removeItem(at: url) }
        let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1))
        let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 48000))
        buffer.frameLength = 48000
        do {
            let file = try AVAudioFile(forWriting: url, settings: format.settings)
            try file.write(from: buffer)
        }
        let clip = ListenClip(audio: url, start: 0.5, end: 2.0)
        let mix = try #require(await ListenClipRange.audioMix(for: AVURLAsset(url: url), clip: clip))
        let parameters = try #require(mix.inputParameters.first)
        var start: Float = -1, end: Float = -1
        var range = CMTimeRange.zero
        #expect(parameters.getVolumeRamp(for: CMTime(seconds: 1.9, preferredTimescale: 1000), startVolume: &start, endVolume: &end, timeRange: &range))
        #expect(start == 1 && end == 0)
        #expect(abs(range.start.seconds - 1.75) < 0.001 && abs(range.end.seconds - 2.0) < 0.001)
    }
}
