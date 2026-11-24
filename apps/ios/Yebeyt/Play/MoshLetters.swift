import Foundation

/// The letters of مشاعره, by the rules of the server (`apps/server/src/persian.ts`, tested with the same table): no
/// diacritics, a lone hamza or tatweel, no digits, punctuation, spaces or half-spaces; ي ى ئ → ی, ك → ک,
/// أ إ آ ٱ → ا, ة ۀ → ه. A couplet starts with the first letter of its first hemistich and ends with the last
/// letter of its second.
enum MoshLetters {
    private static let folded: [UInt32: Character] = [
        0x064A: "ی", 0x0649: "ی", 0x0626: "ی", 0x0643: "ک", 0x0622: "ا", 0x0623: "ا", 0x0625: "ا", 0x0671: "ا", 0x0629: "ه", 0x06C0: "ه",
    ]

    /// The letter of a character, folded as above; nil for what is skipped.
    private static func letter(_ scalar: Unicode.Scalar) -> Character? {
        switch scalar.properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter: break
        default: return nil  // marks, digits, punctuation, spaces and the half-space
        }
        if scalar.value == 0x0621 || scalar.value == 0x0640 { return nil }
        return folded[scalar.value] ?? Character(String(scalar).lowercased())
    }

    /// The letters of a text, folded as above.
    static func letters(_ text: String) -> [Character] {
        text.unicodeScalars.compactMap(letter)
    }

    /// The letter a couplet starts with (its first hemistich), nil when the text has none.
    static func first(of m1: String) -> Character? {
        for scalar in m1.unicodeScalars { if let found = letter(scalar) { return found } }
        return nil
    }

    /// The letter a couplet ends with (its second hemistich), nil when the text has none.
    static func last(of m2: String) -> Character? {
        for scalar in m2.unicodeScalars.reversed() { if let found = letter(scalar) { return found } }
        return nil
    }

    /// Where the last letter of a text is (with the marks that go with it), for the highlight in the last couplet.
    static func lastLetterRange(in text: String) -> Range<String.Index>? {
        guard let index = text.indices.last(where: { text[$0].unicodeScalars.contains { letter($0) != nil } }) else { return nil }
        return index..<text.index(after: index)
    }
}
