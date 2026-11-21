import SwiftUI

/// Dark, cinematic palette from the prototype. One accent the reader picks (turquoise blue by default).
enum Palette {
    static let bg = Color(hex: 0x0F0F12)
    static let surface = Color(hex: 0x1A1A1F)
    static let sunk = Color(hex: 0x25252C)
    static let ink = Color(hex: 0xF4F0E8)
    static let muted = Color(hex: 0xA8A39A)
    static let line = Color.white.opacity(0.09)
    static let lapis = Color(hex: 0xA9BBFF)
    static let lapisSoft = Color(hex: 0xA9BBFF).opacity(0.14)
    static let good = Color(hex: 0x4CC38A)
    static let accentInk = Color(hex: 0x1B1206)
    static let cardBlack = Color(hex: 0x0C0C0F)
    static let softText = Color(hex: 0xD4CFC5)
    static let glass = Color(hex: 0x1E1E24).opacity(0.72)
}

enum Accent: String, CaseIterable, Codable, Identifiable {
    case firuze, saffron, anar, lajvard
    var id: String { rawValue }
    var color: Color {
        switch self {
        case .saffron: Color(hex: 0xF0A24A)
        case .firuze: Color(hex: 0x2EC4D6)
        case .anar: Color(hex: 0xF06A7A)
        case .lajvard: Color(hex: 0x8EA7FF)
        }
    }
    /// Text and icon colour on top of the accent.
    var onColor: Color { self == .firuze ? Color(hex: 0x04191C) : Color(hex: 0x1B1206) }
    var label: String {
        switch self {
        case .saffron: "زعفرانی"
        case .firuze: "آبی فیروزه‌ای"
        case .anar: "اناری"
        case .lajvard: "لاجوردی"
        }
    }
}

/// The eight verse fonts. All open source; Parastoo is the default.
enum VerseFont: String, CaseIterable, Codable, Identifiable {
    case parastoo, gandom, sahel, shabnam, markazi, naskh, nastaliq, modern
    var id: String { rawValue }
    var label: String {
        switch self {
        case .parastoo: "پرستو"
        case .gandom: "گندم"
        case .sahel: "ساحل"
        case .shabnam: "شبنم"
        case .markazi: "مرکزی"
        case .naskh: "نوتو نسخ"
        case .nastaliq: "نستعلیق"
        case .modern: "وزیرمتن"
        }
    }
    var note: String {
        switch self {
        case .parastoo: "پیش‌فرض · نسخِ فارسی، خوانا"
        case .gandom: "کتابی و گرم"
        case .sahel: "ساده و امروزی"
        case .shabnam: "نرم و گرد"
        case .markazi: "نسخ کتابی"
        case .naskh: "نسخ کلاسیک"
        case .nastaliq: "خوشنویسی"
        case .modern: "همون فونت اپ"
        }
    }
    var postScript: String {
        switch self {
        case .parastoo: "Parastoo-WOL"
        case .gandom: "Gandom-WOL"
        case .sahel: "Sahel-WOL"
        case .shabnam: "Shabnam-WOL"
        case .markazi: "MarkaziText-Regular"
        case .naskh: "NotoNaskhArabic-Regular"
        case .nastaliq: "NotoNastaliqUrdu-Regular"
        case .modern: "Vazirmatn-Regular"
        }
    }
    /// Size factor so every font reads at the same optical size.
    var factor: CGFloat {
        switch self {
        case .parastoo: 1.06
        case .gandom: 1.04
        case .markazi: 1.16
        default: 1
        }
    }
    /// Extra line spacing, as a fraction of the font size.
    var leading: CGFloat {
        switch self {
        case .nastaliq: 1.1
        case .markazi: 0.5
        default: 0.6
        }
    }
}

extension Font {
    /// App UI type: Vazirmatn, light weights preferred.
    static func ui(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom("Vazirmatn", size: size).weight(weight)
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: alpha)
    }
    /// CSS-style hsl(h, s%, l%).
    init(h: Double, s: Double, l: Double, a: Double = 1) {
        let (r, g, b) = hslToRGB(h, s, l)
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}

func hslToRGB(_ h: Double, _ s: Double, _ l: Double) -> (Double, Double, Double) {
    let hh = ((h.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360) / 360
    let ss = s / 100, ll = l / 100
    if ss == 0 { return (ll, ll, ll) }
    let q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
    let p = 2 * ll - q
    func f(_ t0: Double) -> Double {
        var t = t0
        if t < 0 { t += 1 }
        if t > 1 { t -= 1 }
        if t < 1.0 / 6 { return p + (q - p) * 6 * t }
        if t < 1.0 / 2 { return q }
        if t < 2.0 / 3 { return p + (q - p) * (2.0 / 3 - t) * 6 }
        return p
    }
    return (f(hh + 1.0 / 3), f(hh), f(hh - 1.0 / 3))
}

// MARK: - Persian text helpers

extension String {
    /// Western digits to Persian digits.
    var fa: String {
        let digits: [Character: Character] = ["0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴", "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹"]
        return String(self.map { digits[$0] ?? $0 })
    }
    /// Normalised form for search: no diacritics, Persian ye/ke, ZWNJ as space.
    var norm: String {
        var s = self.applyingTransform(.stripCombiningMarks, reverse: false) ?? self
        s = s.replacingOccurrences(of: "ي", with: "ی").replacingOccurrences(of: "ك", with: "ک")
            .replacingOccurrences(of: "\u{200C}", with: " ").replacingOccurrences(of: "\u{200F}", with: " ")
            .replacingOccurrences(of: "\u{200E}", with: " ").replacingOccurrences(of: "ۀ", with: "ه")
            .replacingOccurrences(of: "أ", with: "ا").replacingOccurrences(of: "إ", with: "ا").replacingOccurrences(of: "آ", with: "ا")
        return s.lowercased()
    }
    /// First n sentences (split on . ؟ !).
    func firstSentences(_ n: Int = 2) -> String {
        var out = "", count = 0
        for ch in self {
            out.append(ch)
            if ch == "." || ch == "؟" || ch == "!" {
                count += 1
                if count >= n { break }
            }
        }
        return out.trimmingCharacters(in: .whitespaces)
    }
}

extension Int {
    var fa: String { String(self).fa }
}

/// A deterministic hue from a string (same as the prototype's hashHue).
func hashHue(_ s: String) -> Double {
    var h = 0
    for u in s.unicodeScalars { h = (h * 31 + Int(u.value)) % 360 }
    return Double(h)
}

/// Hijri (qamari) year to an approximate Gregorian year.
func ceYear(_ h: Int) -> Int { Int((Double(h) * 0.970224 + 621.5643).rounded()) }
func yearsAgo(_ h: Int) -> Int {
    let y = Calendar(identifier: .gregorian).component(.year, from: .now)
    return Int((Double(y - ceYear(h)) / 10).rounded()) * 10
}
