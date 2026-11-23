import Foundation

/// The words the reader writes around a couplet.
enum ReaderText {
    /// «غزل شمارهٔ ۳» → «غزل ۳».
    static func shortTitle(_ title: String) -> String {
        title.replacingOccurrences(of: "شمارهٔ ", with: "")
    }

    /// «حافظ · غزلیات»; just the poet while the book title is not known.
    static func subtitle(poet: String, book: String?) -> String {
        book.map { "\(poet) · \($0)" } ?? poet
    }

    /// «۲ از ۹» for the couplet at the 0-based `index`. Never "۲/۹": it reorders in right-to-left text.
    static func progress(index: Int, count: Int) -> String {
        "\(PersianDigits.string(index + 1)) از \(PersianDigits.string(count))"
    }

    static func progressLabel(index: Int, count: Int) -> String {
        "بیت \(progress(index: index, count: count))"
    }

    /// The text of the share sheet.
    static func shareText(_ couplet: Couplet, poet: String, title: String) -> String {
        "\(lines(of: couplet))\n— \(poet) · \(title)\nyebeyt.com"
    }

    /// The text «کپی متن» puts on the pasteboard.
    static func copyText(_ couplet: Couplet, poet: String) -> String {
        "\(lines(of: couplet))\n— \(poet)"
    }

    /// The caption under a lifted couplet: «حافظ · غزل ۳ · بیت ۲».
    static func caption(poet: String, title: String, index: Int) -> String {
        "\(poet) · \(title) · بیت \(PersianDigits.string(index + 1))"
    }

    private static func lines(of couplet: Couplet) -> String {
        couplet.m2.isEmpty ? couplet.m1 : "\(couplet.m1)\n\(couplet.m2)"
    }
}
