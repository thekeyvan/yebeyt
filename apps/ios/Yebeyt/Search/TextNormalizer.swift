import Foundation

/// The one text normalisation used for matching (search, mood words, section search): no diacritics or
/// tatweel, Arabic ي/ى → ی, ك → ک, ZWNJ → space, آ/أ/إ → ا, ة → ه, Persian and Arabic digits → 0–9,
/// punctuation → space, lower case, single spaces.
enum TextNormalizer {
    static func normalize(_ text: String) -> String {
        var result = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            switch scalar.value {
            case 0x064B...0x065F, 0x0670, 0x0640:
                continue
            case 0x064A, 0x0649:
                result.append("\u{06CC}")
            case 0x0643:
                result.append("\u{06A9}")
            case 0x0622, 0x0623, 0x0625:
                result.append("\u{0627}")
            case 0x0629:
                result.append("\u{0647}")
            case 0x200C, 0x200D:
                result.append(" ")
            case 0x06F0...0x06F9:
                result.append(Unicode.Scalar(scalar.value - 0x06F0 + 0x30)!)
            case 0x0660...0x0669:
                result.append(Unicode.Scalar(scalar.value - 0x0660 + 0x30)!)
            default:
                result.append(CharacterSet.punctuationCharacters.contains(scalar) ? " " : scalar)
            }
        }
        return String(result).lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    /// Whether `text` contains `query` once both are normalised. An empty query matches nothing.
    static func contains(_ text: String, query: String) -> Bool {
        let wanted = normalize(query)
        return !wanted.isEmpty && normalize(text).contains(wanted)
    }
}
