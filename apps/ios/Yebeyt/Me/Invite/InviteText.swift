import Foundation

/// The tone presets of «متن دعوت». The body ends with a colon: the opener couplet follows it.
enum InviteTone: CaseIterable, Sendable {
    case friendly, poetic, short

    var title: String {
        switch self {
        case .friendly: "رفیقانه"
        case .poetic: "شاعرانه"
        case .short: "کوتاه"
        }
    }

    var body: String {
        switch self {
        case .friendly: "یه اپ پیدا کردم که شعر فارسی رو بازی می‌کنه! هر روز یه بیت، جورچین، مشاعره با رفیقا. بیا با هم مشاعره کنیم، من شروع می‌کنم:"
        case .poetic: "شعر فارسی رو با یه بیت دوباره پیدا کردم؛ هر روز یه بیت، یه بازی. بیا با هم مشاعره کنیم، من شروع می‌کنم:"
        case .short: "بیا با هم مشاعره کنیم:"
        }
    }
}

enum InviteMessage {
    /// The couplet that starts the مشاعره: it ends in «ا», so the friend answers with a couplet starting with «ا».
    static let opener = "الا یا ایها الساقی ادر کأسا و ناولها"

    /// The body, the opener in guillemets, and the personal link, each on its own line.
    static func text(body: String, link: String) -> String {
        "\(body)\n«\(opener)»\n\(link)"
    }
}

/// The messengers of the share row. Each has a URL that opens its compose screen with the text.
enum InviteChannel: CaseIterable, Sendable {
    case sms, telegram, whatsApp

    var title: String {
        switch self {
        case .sms: "پیامک"
        case .telegram: "تلگرام"
        case .whatsApp: "واتس‌اپ"
        }
    }

    var scheme: String {
        switch self {
        case .sms: "sms"
        case .telegram: "tg"
        case .whatsApp: "whatsapp"
        }
    }

    func url(for text: String) -> URL? {
        let encoded = Self.escape(text)
        switch self {
        case .sms: return URL(string: "sms:&body=\(encoded)")
        case .telegram: return URL(string: "tg://msg?text=\(encoded)")
        case .whatsApp: return URL(string: "whatsapp://send?text=\(encoded)")
        }
    }

    /// Everything but letters, digits and `-._~` is escaped, so `&`, `=`, `?`, `#`, `+` and new lines stay in the text.
    private static func escape(_ text: String) -> String {
        text.addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")) ?? ""
    }
}
