import Foundation

/// «معمای امروز»: one couplet and one word of it, the same for everyone on a Tehran day.
struct DailyPuzzle: Equatable, Sendable {
    /// The words that are too easy or too common to hide: a hidden «که» is no puzzle. Compared as letters.
    static let stopWords: Set<String> = [
        "این", "آن", "اگر", "همه", "هر", "هم", "چون", "چو", "چنین", "چنان", "کجا", "کنون", "نیز", "پس", "مگر",
        "بود", "است", "شد", "شود", "باشد", "کرد", "کند", "دارد", "نه", "نی", "من", "تو", "او", "ما", "شما",
        "ایشان", "مرا", "ترا", "وین", "وان", "کان", "کین", "کز", "زان", "زین", "بدین", "بدان", "همچو", "همی",
        "بر", "در", "از", "به", "با", "تا", "که", "را", "یا", "ور", "اندر", "بی", "ای", "هیچ", "جز", "آنکه",
    ]

    static let letterRange = 3...6
    /// The keys of the keyboard under the grid, besides «پاک کن»: the word's letters and distractors.
    static let keyCount = 12

    let couplet: GameCouplet
    /// The hidden word as written in the couplet, with its diacritics.
    let word: String
    /// Its letters as the game compares them.
    let letters: [Character]
    /// False when the word is in the first hemistich (only when the second has none).
    let inSecondHemistich: Bool
    /// Where the word is among the words of its hemistich.
    let wordIndex: Int
    /// The keyboard: every letter of the word, distractors up to `keyCount`, in an order fixed for the day.
    let keys: [Character]

    /// The words of the hemistich around the hidden one: `(before, after)`, as written.
    var around: (before: String, after: String) {
        let words = hemistich.split(whereSeparator: \.isWhitespace).map(String.init)
        return (words[..<wordIndex].joined(separator: " "), words[(wordIndex + 1)...].joined(separator: " "))
    }

    /// The hemistich the word is in.
    var hemistich: String { inSecondHemistich ? couplet.m2 : couplet.m1 }

    /// The puzzle of a day. The couplet is taken from a day-seeded start in the deck, the first one that has a
    /// fitting word (3–6 letters, not a stop word, from the second hemistich when it has one).
    static func pick(day: TehranDay, from deck: GameDeck) -> DailyPuzzle? {
        guard !deck.couplets.isEmpty else { return nil }
        var generator = SeededGenerator(seed: UInt64(bitPattern: Int64(day.number)) &* 0x2545_F491_4F6C_DD1D)
        let start = Int(generator.next() % UInt64(deck.couplets.count))
        for step in 0..<deck.couplets.count {
            let couplet = deck.couplets[(start + step) % deck.couplets.count]
            for second in [true, false] {
                let words = candidates(in: second ? couplet.m2 : couplet.m1)
                guard !words.isEmpty else { continue }
                let chosen = words[Int(generator.next() % UInt64(words.count))]
                return DailyPuzzle(
                    couplet: couplet, word: chosen.word, letters: chosen.letters, inSecondHemistich: second,
                    wordIndex: chosen.index, keys: keys(for: chosen.letters, generator: &generator)
                )
            }
        }
        return nil
    }

    /// The hideable words of a hemistich, in order.
    static func candidates(in hemistich: String) -> [(index: Int, word: String, letters: [Character])] {
        hemistich.split(whereSeparator: \.isWhitespace).enumerated().compactMap { index, token in
            guard let letters = PersianLetters.letters(of: String(token)), letterRange.contains(letters.count),
                  !stopWords.contains(String(letters)) else { return nil }
            return (index, String(token), letters)
        }
    }

    /// The word's own letters and other letters of the alphabet, `keyCount` in all, shuffled.
    static func keys(for letters: [Character], generator: inout SeededGenerator) -> [Character] {
        var own: [Character] = []
        for letter in letters where !own.contains(letter) { own.append(letter) }
        let others = generator.shuffled(PersianLetters.alphabet.filter { !own.contains($0) })
        return generator.shuffled(own + others.prefix(max(0, keyCount - own.count)))
    }
}
