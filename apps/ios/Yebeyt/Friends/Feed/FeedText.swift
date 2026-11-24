import Foundation

/// The words of a feed item (Calm): «کیان یه بیت به اشتراک گذاشت» over «یک ساعت پیش».
enum FeedText {
    /// The line about what the friend did, without their name.
    static func action(_ item: FeedItem) -> String {
        switch item.type {
        case .repost: "یه بیت به اشتراک گذاشت"
        case .like: "یه بیت پسندید"
        case .daily: "معمای امروز رو با \(PersianDigits.string(item.tries ?? 1)) فرصت حل کرد"
        }
    }

    /// «کیان یه بیت به اشتراک گذاشت», for VoiceOver and tests.
    static func headline(_ item: FeedItem) -> String {
        "\(item.user.name) \(action(item))"
    }

    /// The poem path and the 0-based couplet of a couplet key «/hafez/ghazal/sh3#1».
    static func coupletRoute(of key: String) -> ReaderRoute? {
        guard let hash = key.lastIndex(of: "#"), let index = Int(key[key.index(after: hash)...]), index >= 0 else { return nil }
        let path = String(key[..<hash])
        return path.hasPrefix("/") && path.count > 1 ? ReaderRoute(path: path, couplet: index) : nil
    }

    /// «همین الان», «۱۰ دقیقه پیش», «یک ساعت پیش», «۳ ساعت پیش», «دیروز», «۳ روز پیش», then the date «۲۴ آبان».
    static func relativeTime(_ text: String, now: Date = .now) -> String {
        guard let date = ServerTime.date(from: text) else { return "" }
        let seconds = max(0, Int(now.timeIntervalSince(date)))
        switch seconds {
        case ..<60: return "همین الان"
        case ..<3600: return "\(PersianDigits.string(seconds / 60)) دقیقه پیش"
        case ..<86_400:
            let hours = seconds / 3600
            return hours == 1 ? "یک ساعت پیش" : "\(PersianDigits.string(hours)) ساعت پیش"
        case ..<172_800: return "دیروز"
        case ..<604_800: return "\(PersianDigits.string(seconds / 86_400)) روز پیش"
        default: return PersianDate.short(for: date)
        }
    }
}
