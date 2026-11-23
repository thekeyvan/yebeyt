import Foundation

/// A small random generator that gives the same numbers for the same seed, so the daily puzzle and its
/// keyboard are the same for everyone, and tests can fix the rounds.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    /// A shuffle that never changes between releases of iOS (Fisher–Yates, with this generator).
    mutating func shuffled<T>(_ items: [T]) -> [T] {
        var items = items
        for index in stride(from: items.count - 1, to: 0, by: -1) {
            items.swapAt(index, Int(next() % UInt64(index + 1)))
        }
        return items
    }
}

/// Persian letters as the word game sees them: one letter per box, no diacritics, Arabic forms folded into
/// the Persian ones (ي ى → ی, ك → ک, أ إ → ا, ة → ه). آ stays its own letter: the keyboard shows it.
enum PersianLetters {
    static let alphabet = Array("ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیآئؤ")

    /// The letters of a word, or nil when it holds anything else (digits, a half-space, a hyphen…).
    /// Punctuation around the word is ignored.
    static func letters(of word: String) -> [Character]? {
        let trimmed = word.trimmingCharacters(in: .punctuationCharacters.union(.symbols).union(.whitespaces))
        var result: [Character] = []
        for scalar in trimmed.unicodeScalars {
            switch scalar.value {
            case 0x064B...0x065F, 0x0670, 0x0640: continue
            case 0x064A, 0x0649: result.append("ی")
            case 0x0643: result.append("ک")
            case 0x0623, 0x0625: result.append("ا")
            case 0x0629: result.append("ه")
            default:
                guard alphabet.contains(Character(scalar)) else { return nil }
                result.append(Character(scalar))
            }
        }
        return result.isEmpty ? nil : result
    }
}
