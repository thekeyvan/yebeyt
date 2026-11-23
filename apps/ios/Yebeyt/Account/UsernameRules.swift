import Foundation

/// The username rules, mirroring the server (`apps/server/src/usernames.ts`) so the screen can answer while typing.
/// The server stays the judge: it also knows which names are taken.
enum UsernameRules {
    enum Problem: String, Equatable, Sendable {
        case tooShort = "too_short"
        case tooLong = "too_long"
        case badChars = "bad_chars"
        case reserved
        case taken

        /// The line under the field.
        var message: String {
            switch self {
            case .taken: "قبلاً گرفته شده"
            case .tooShort: "حداقل ۳ حرف"
            case .tooLong: "حداکثر ۲۰ حرف"
            case .badChars: "فقط حروف انگلیسی، عدد، «_» و «.»"
            case .reserved: "این اسم رزرو شده"
            }
        }
    }

    static let reserved: Set<String> = [
        "yebeyt", "admin", "administrator", "support", "hello", "help", "api", "www", "root", "system",
        "moderator", "staff", "team", "official", "contact", "info", "security", "privacy", "terms",
        "null", "undefined", "me", "app", "ios", "android",
    ]

    /// The stored form: trimmed and lower-case.
    static func normalize(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Checks the rules (not availability) of a normalized name.
    static func problem(_ name: String) -> Problem? {
        let scalars = Array(name.unicodeScalars)
        func isLetter(_ s: Unicode.Scalar) -> Bool { ("a"..."z").contains(s) }
        func isAllowed(_ s: Unicode.Scalar) -> Bool { isLetter(s) || ("0"..."9").contains(s) || s == "_" || s == "." }
        if !scalars.allSatisfy(isAllowed) { return .badChars }
        if scalars.count < 3 { return .tooShort }
        if scalars.count > 20 { return .tooLong }
        if !isLetter(scalars[0]) || name.contains("..") || name.hasSuffix(".") { return .badChars }
        if reserved.contains(name) { return .reserved }
        return nil
    }

    /// A Latin base for the server's suggestions: the letters and digits of a name written in Latin letters,
    /// or «beyt» for a name that has none (Persian names).
    static func suggestionBase(from displayName: String) -> String {
        var kept = displayName.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil).lowercased()
            .filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
        while let first = kept.first, !first.isLetter { kept.removeFirst() }
        let base = String(kept.prefix(16))
        return base.count >= 2 ? base : "beyt"
    }
}
