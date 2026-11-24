import Foundation

/// A calendar day in Tehran. The daily puzzle and the streak change at Tehran midnight, for everyone.
struct TehranDay: Hashable, Comparable, Codable, Sendable {
    /// Days since 1970-01-01.
    let number: Int

    private static let zone = TimeZone(identifier: "Asia/Tehran") ?? TimeZone(secondsFromGMT: 12600)!
    private static let secondsPerDay = 86_400

    private static var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    init(number: Int) {
        self.number = number
    }

    init(date: Date) {
        let local = Int(date.timeIntervalSince1970.rounded(.down)) + Self.zone.secondsFromGMT(for: date)
        number = Int((Double(local) / Double(Self.secondsPerDay)).rounded(.down))
    }

    /// «2026-11-23»; nil for anything else, or a date that doesn't exist.
    init?(key: String) {
        let parts = key.split(separator: "-", omittingEmptySubsequences: false).map { Int($0) }
        guard parts.count == 3, let year = parts[0], let month = parts[1], let day = parts[2] else { return nil }
        let wanted = DateComponents(year: year, month: month, day: day)
        guard let date = Self.utc.date(from: wanted), Self.utc.dateComponents([.year, .month, .day], from: date) == wanted else { return nil }
        number = Int(date.timeIntervalSince1970) / Self.secondsPerDay
    }

    static func < (lhs: TehranDay, rhs: TehranDay) -> Bool { lhs.number < rhs.number }

    var previous: TehranDay { TehranDay(number: number - 1) }

    /// The moment this day began, at midnight in Tehran.
    var start: Date {
        let midnightUTC = Date(timeIntervalSince1970: TimeInterval(number * Self.secondsPerDay))
        return midnightUTC.addingTimeInterval(-TimeInterval(Self.zone.secondsFromGMT(for: midnightUTC)))
    }

    /// «2026-11-23», the form `-beytToday` takes.
    var key: String {
        let parts = Self.utc.dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: TimeInterval(number * Self.secondsPerDay)))
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// Noon in Tehran, for showing the day in the Persian calendar.
    var noon: Date {
        let midnightUTC = Date(timeIntervalSince1970: TimeInterval(number * Self.secondsPerDay))
        return midnightUTC.addingTimeInterval(TimeInterval(Self.secondsPerDay / 2 - Self.zone.secondsFromGMT(for: midnightUTC)))
    }

    /// «دوشنبه ۲ آذر».
    var line: String { PersianDate.line(for: noon, timeZone: Self.zone) }

    /// «۲۴ آبان»
    var shortLine: String { PersianDate.short(for: noon, timeZone: Self.zone) }

    /// The day and month for the date sticker: «۱» over «آذر».
    var stickerParts: (day: String, month: String) {
        var calendar = Calendar(identifier: .persian)
        calendar.locale = Locale(identifier: "fa_IR")
        calendar.timeZone = Self.zone
        let parts = calendar.dateComponents([.day, .month], from: noon)
        guard let day = parts.day, let month = parts.month else { return ("", "") }
        return (PersianDigits.string(day), calendar.monthSymbols[month - 1])
    }
}
