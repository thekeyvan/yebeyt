import SwiftUI

/// The nine games. Only the built ones open; the rest sit dimmed in the catalog until their slice.
enum GameKind: String, CaseIterable, Sendable {
    case daily, jigsaw, poet, misra, book, match, listen, mosh, duel

    var name: String {
        switch self {
        case .daily: "معمای امروز"
        case .jigsaw: "جورچین بیت"
        case .poet: "حدس شاعر"
        case .misra: "مصراع دوم"
        case .book: "از کدوم کتاب؟"
        case .match: "معنی‌یاب"
        case .listen: "گوش کن"
        case .mosh: "مشاعره"
        case .duel: "بازی رودررو"
        }
    }

    /// The line under the name in the catalog.
    var meta: String {
        switch self {
        case .daily: "روزانه · ۱ دقیقه · رشته‌ی روزها"
        case .jigsaw: "تکی · ۱۰ بیت · ۲ دقیقه"
        case .poet: "تکی · ۱۰ سؤال · زمان‌دار"
        case .misra: "تکی · ۱۰ سؤال · ۲ دقیقه"
        case .book: "تکی · ۱۰ سؤال"
        case .match: "تکی · ۵ جفت · بی‌عجله"
        case .listen: "تکی · ۵ سؤال · با هدفون"
        case .mosh: "با دوست یا «یه بیت» · تا وقتی کسی کم بیاره"
        case .duel: "با دوست · ۵ دور · ۳ دقیقه"
        }
    }

    /// The paragraph of the catalog card.
    var about: String {
        switch self {
        case .daily: "یه بیت با یه کلمه‌ی جا افتاده؛ حرف‌هاش رو از برچسب‌های پایین بچین، تایپ لازم نیست. ۳ فرصت، برای همه یکی، فردا عوض می‌شه."
        case .jigsaw: "کلمه‌های یه بیت ریخته؛ برچسب‌ها رو بکن و به ترتیب بچسبون."
        case .poet: "یه بیت می‌بینی؛ از بین چهار شاعر (چهره و اسم) شاعرش رو انتخاب کن."
        case .misra: "مصراع اول رو داری؛ مصراع دومِ درست رو از بین سه تا پیدا کن."
        case .book: "شاعر رو بهت می‌گیم؛ تو بگو این بیت از کدوم کتابِ اونه. مثلاً مولانا: مثنوی، دیوان شمس یا فیه ما فیه؟"
        case .match: "واژه‌های سخت یه بیت رو به معنی‌شون وصل کن؛ همون واژه‌های نقطه‌چین."
        case .listen: "مصراع اول با صدا پخش می‌شه و متنش رو نمی‌بینی؛ مصراع دومش رو از بین نوشته‌ها پیدا کن. سطح بالاتر: شاعرش رو بگو."
        case .mosh: "بیتت باید با حرف آخرِ بیتِ اون یکی شروع بشه. نوبتی، با زمان برای هر نوبت."
        case .duel: "۵ دور سریع از بازی‌های بالا، هم‌زمان با یه دوست. هر کی بیشتر برد."
        }
    }

    /// The tagline on the card of the games tab, for the games drawn there.
    var tagline: String? {
        switch self {
        case .jigsaw: "کلمه‌ها رو بچین"
        case .poet: "کی گفته؟ ۴ گزینه"
        case .misra: "مصراع دوم رو پیدا کن"
        case .book: "کدوم کتابِ شاعره؟"
        default: nil
        }
    }

    /// The games with a card on the games tab, in the order of the board.
    static let tabCards: [GameKind] = [.jigsaw, .poet, .misra, .book]

    var isBuilt: Bool { self == .daily || self == .jigsaw }

    /// The sticker's background: one colour, or two split on the diagonal (games with friends).
    var background: (Color, Color?) {
        switch self {
        case .daily: (Tokens.Colors.lapis, nil)
        case .jigsaw: (Tokens.Colors.fire, nil)
        case .poet: (Tokens.Colors.amber, nil)
        case .misra: (Tokens.Colors.green, nil)
        case .book: (Tokens.Colors.magenta, nil)
        case .match: (Color(hex: 0x1C20B8), nil)
        case .listen: (Tokens.Colors.ink, nil)
        case .mosh: (Tokens.Colors.amber, Tokens.Colors.lapis)
        case .duel: (Tokens.Colors.fire, Tokens.Colors.magenta)
        }
    }
}
