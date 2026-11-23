import Foundation

/// The date line of the home screen, in the Persian calendar: «دوشنبه ۲ آذر».
enum PersianDate {
    static func line(for date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .persian)
        calendar.locale = Locale(identifier: "fa_IR")
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.weekday, .day, .month], from: date)
        guard let weekday = parts.weekday, let day = parts.day, let month = parts.month else { return "" }
        return "\(calendar.weekdaySymbols[weekday - 1]) \(PersianDigits.string(day)) \(calendar.monthSymbols[month - 1])"
    }

    /// «۲۴ آبان»
    static func short(for date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .persian)
        calendar.locale = Locale(identifier: "fa_IR")
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.day, .month], from: date)
        guard let day = parts.day, let month = parts.month else { return "" }
        return "\(PersianDigits.string(day)) \(calendar.monthSymbols[month - 1])"
    }
}
