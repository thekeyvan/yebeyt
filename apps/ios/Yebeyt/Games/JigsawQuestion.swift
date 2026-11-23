import Foundation

/// A word on the sticker sheet. Its id tells two stickers with the same word apart.
struct JigsawSticker: Identifiable, Hashable, Sendable {
    let id: Int
    let word: String
}

/// One couplet of جورچین بیت: the first hemistich whole, the second cut into word slots. Some slots are filled
/// already; the others wait for a sticker. The sheet holds those words and two more that fit nowhere.
struct JigsawQuestion: Equatable, Sendable {
    static let wordRange = 3...14
    static let maxMissing = 6
    static let extraStickers = 2

    let couplet: GameCouplet
    /// The words of the second hemistich, in order.
    let words: [String]
    /// The positions that wait for a sticker, in order.
    let missing: [Int]
    /// The missing words and the extra ones, in the order the sheet first shows them.
    let stickers: [JigsawSticker]

    /// Whether a couplet can be played: a first hemistich and a second one of 3–14 words.
    static func canPlay(_ couplet: GameCouplet) -> Bool {
        !couplet.m1.trimmingCharacters(in: .whitespaces).isEmpty && wordRange.contains(couplet.m2.split(whereSeparator: \.isWhitespace).count)
    }

    /// How many words go missing: half of them, at least two and at most six.
    static func missingCount(words: Int) -> Int {
        min(maxMissing, max(2, (words + 1) / 2))
    }

    /// `distractors` are words from other couplets; the first two that are not words of this couplet become the extras.
    init?(couplet: GameCouplet, distractors: [String], generator: inout SeededGenerator) {
        guard Self.canPlay(couplet) else { return nil }
        let words = couplet.m2.split(whereSeparator: \.isWhitespace).map(String.init)
        let missing = generator.shuffled(Array(words.indices)).prefix(Self.missingCount(words: words.count)).sorted()
        let known = Set(words.map(TextNormalizer.normalize))
        var extras: [String] = []
        for word in distractors where extras.count < Self.extraStickers {
            let plain = TextNormalizer.normalize(word)
            if !plain.isEmpty, !known.contains(plain), !extras.contains(where: { TextNormalizer.normalize($0) == plain }) { extras.append(word) }
        }
        self.couplet = couplet
        self.words = words
        self.missing = missing
        stickers = generator.shuffled(missing.map { words[$0] } + extras).enumerated().map { JigsawSticker(id: $0.offset, word: $0.element) }
    }
}
