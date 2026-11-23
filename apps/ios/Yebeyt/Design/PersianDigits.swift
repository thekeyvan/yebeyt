/// Counts shown to people use Persian digits (۰–۹) and the Persian thousands separator (٬).
enum PersianDigits {
    private static let digits: [Character: Character] = [
        "0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴", "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹",
    ]

    /// 2480 → «۲۴۸۰». For counts, so zero or more.
    static func string(_ number: Int) -> String {
        String(String(number).map { digits[$0] ?? $0 })
    }

    /// 2480 → «۲٬۴۸۰».
    static func grouped(_ number: Int) -> String {
        let plain = Array(String(number))
        var result: [Character] = []
        for (index, digit) in plain.enumerated() {
            if index > 0, (plain.count - index) % 3 == 0 { result.append("٬") }
            result.append(digit)
        }
        return String(result.map { digits[$0] ?? $0 })
    }
}
