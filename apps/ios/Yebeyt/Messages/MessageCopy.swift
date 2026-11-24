import Foundation

/// The words of messages that no board has: the lead's copy, kept in one place.
enum MessageCopy {
    static let sending = "در حال فرستادن"
    static let notSent = "نرسید · دوباره"
    static let closed = "دیگه نمی‌تونی به این گفتگو پیام بدی"
    static let slowDown = "یه کم آروم‌تر"
    static let friendsOnlyDivan = "فقط با دوستات می‌شه دیوان مشترک داشت"
    static let deletedMessage = "این پیام پاک شد"
    static let reported = "گزارشت رسید"
    static let seen = "دیده شد"
    static let newMessage = "پیام تازه"
    static let divanOpenFailed = "دیوان مشترک باز نشد"

    /// «سارا یه بیت به دیوان مشترک اضافه کرد»
    static func divanAdded(by name: String) -> String { "\(name) یه بیت به دیوان مشترک اضافه کرد" }

    static let divanAddedByMe = "تو یه بیت به دیوان مشترک اضافه کردی"

    /// «به دیوان من و سارا اضافه شد»
    static func addedToDivan(with name: String) -> String { "به دیوان من و \(name) اضافه شد" }

    /// A line of a game message, until the game cards of slice 8c: «سارا دعوتت کرد به مشاعره».
    static func gameInvite(from name: String, game: String?) -> String {
        "\(name) دعوتت کرد به \(gameName(game))"
    }

    static func gameName(_ kind: String?) -> String {
        switch kind {
        case "mosh": "مشاعره"
        case "duel": "بازی رودررو"
        default: "بازی"
        }
    }

    /// The line a failed call shows as a toast. A send refused for `messages_closed` is not a toast (the composer
    /// says it); `sharedDivan` is for a call that needs a friendship.
    static func toast(for error: APIError, sharedDivan: Bool = false) -> String {
        guard case .server(let status, let code, _) = error else { return error.persianMessage }
        if status == 429 || code == .rateLimited { return slowDown }
        if code == .messagesClosed { return closed }
        if sharedDivan, status == 403 { return friendsOnlyDivan }
        return error.persianMessage
    }
}

/// Times in chats, in Persian digits and the phone's time zone.
enum ChatTime {
    /// «۹:۴۵» (24 hours, minutes with two digits).
    static func clock(_ date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        let (hour, minute) = (parts.hour ?? 0, parts.minute ?? 0)
        return "\(PersianDigits.string(hour)):\(PersianDigits.string(minute / 10))\(PersianDigits.string(minute % 10))"
    }

    /// The label of a day: «امروز», «دیروز», the weekday up to six days back, then «۲۴ آبان».
    static func day(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 0
        switch days {
        case ...0: return "امروز"
        case 1: return "دیروز"
        case 2...6: return weekday(date, calendar: calendar)
        default: return PersianDate.short(for: date, timeZone: calendar.timeZone)
        }
    }

    /// The inbox's stamp: the time today, else the label of the day (but never «امروز»).
    static func stamp(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        calendar.isDate(date, inSameDayAs: now) ? clock(date, calendar: calendar) : day(date, now: now, calendar: calendar)
    }

    /// The time on a card of the shared divan: «امروز», «دیروز», «۳ روز پیش», «هفته‌ی پیش» (up to two weeks), then «۹ مهر».
    static func added(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 0
        switch days {
        case ...0: return "امروز"
        case 1: return "دیروز"
        case 2...6: return "\(PersianDigits.string(days)) روز پیش"
        case 7...13: return "هفته‌ی پیش"
        default: return PersianDate.short(for: date, timeZone: calendar.timeZone)
        }
    }

    private static func weekday(_ date: Date, calendar: Calendar) -> String {
        var persian = Calendar(identifier: .persian)
        persian.locale = Locale(identifier: "fa_IR")
        persian.timeZone = calendar.timeZone
        return persian.weekdaySymbols[persian.component(.weekday, from: date) - 1]
    }
}

/// «لیگ غزل‌باز»: the tiers 0 to 4 of the weekly leagues, named as the levels.
enum LeagueName {
    static let tiers = ["نوآموز", "بیت‌خوان", "غزل‌باز", "سخن‌دان", "استاد سخن"]

    static func line(tier: Int) -> String? {
        tiers.indices.contains(tier) ? "لیگ \(tiers[tier])" : nil
    }
}

/// A couplet key as the server and the divan write it: «/hafez/ghazal/sh3#0».
enum CoupletKey {
    static func parse(_ key: String) -> (path: String, index: Int)? {
        guard let hash = key.lastIndex(of: "#"), let index = Int(key[key.index(after: hash)...]), index >= 0 else { return nil }
        let path = String(key[..<hash])
        return path.hasPrefix("/") && path.count > 1 ? (path, index) : nil
    }
}

extension String {
    /// The longest start of the text that is at most `limit` UTF-16 code units (how the server counts the 1000 and
    /// 200), never cutting a letter or an emoji in half.
    func limited(toUTF16 limit: Int) -> String {
        var result = ""
        var used = 0
        for character in self {
            let size = character.utf16.count
            if used + size > limit { break }
            result.append(character)
            used += size
        }
        return result
    }
}
