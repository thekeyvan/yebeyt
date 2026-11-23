import Foundation
import Observation
import SwiftUI

/// The fonts of the «آ» sheet, in the board's order. Only Parastoo has a bold file.
enum ReaderFont: String, CaseIterable, Codable, Sendable {
    case parastoo, naskh, nastaliq, gandom, markazi, shabnam, sahel, vazir

    var title: String {
        switch self {
        case .parastoo: "پرستو"
        case .naskh: "نسخ"
        case .nastaliq: "نستعلیق"
        case .gandom: "گندم"
        case .markazi: "مرکزی"
        case .shabnam: "شبنم"
        case .sahel: "ساحل"
        case .vazir: "وزیر"
        }
    }

    func postScript(bold: Bool) -> String {
        switch self {
        case .parastoo: bold ? Tokens.Fonts.poem.postScript : Tokens.Fonts.poemRegular.postScript
        case .naskh: Tokens.ReaderFonts.naskh.postScript
        case .nastaliq: Tokens.ReaderFonts.nastaliq.postScript
        case .gandom: Tokens.ReaderFonts.gandom.postScript
        case .markazi: Tokens.ReaderFonts.markazi.postScript
        case .shabnam: Tokens.ReaderFonts.shabnam.postScript
        case .sahel: Tokens.ReaderFonts.sahel.postScript
        case .vazir: Tokens.ReaderFonts.vazir.postScript
        }
    }

    /// The boards scale Parastoo to 84% (CSS size-adjust); the other fonts are drawn at their own size.
    var glyphScale: CGFloat {
        self == .parastoo ? Tokens.Fonts.poem.sizeAdjust : 1
    }
}

enum HemistichLayout: String, CaseIterable, Codable, Sendable {
    case staggered, centered

    var title: String { self == .staggered ? "پلکانی" : "وسط‌چین" }
}

enum TextSpacing: String, CaseIterable, Codable, Sendable {
    case tight, normal, loose

    var title: String {
        switch self {
        case .tight: "کم"
        case .normal: "معمولی"
        case .loose: "زیاد"
        }
    }

    /// The line height as a multiple of the font size (the board's `line-height`).
    var factor: CGFloat {
        switch self {
        case .tight: 1.5
        case .normal: 1.8
        case .loose: 2.1
        }
    }
}

enum ReaderTheme: String, CaseIterable, Codable, Sendable {
    case light, paper, dark

    var title: String {
        switch self {
        case .light: "روشن"
        case .paper: "کاغذی"
        case .dark: "تیره"
        }
    }

    var background: Color {
        switch self {
        case .light: Tokens.Colors.white
        case .paper: Tokens.Colors.boardPaper
        case .dark: Tokens.Colors.ink
        }
    }

    /// The text colour: ink on light and paper, paper on ink.
    var foreground: Color {
        self == .dark ? Tokens.Colors.boardPaper : Tokens.Colors.ink
    }

    /// Quieter text: the subtitle, the progress count.
    var secondary: Color {
        isDark ? Tokens.Colors.boardPaper.opacity(0.65) : Tokens.Colors.muted
    }

    /// The part of the progress rail that is not read yet.
    var track: Color {
        isDark ? Tokens.Colors.boardPaper.opacity(0.2) : Tokens.Colors.ring
    }

    var isDark: Bool { self == .dark }
}

/// The settings of the «آ» sheet. They apply to both reading modes and are kept on the phone.
struct TextSettings: Codable, Equatable, Sendable {
    /// The slider's range, in the board's font sizes for the couplet page.
    static let sizes = 15...25

    var size = 21 { didSet { size = min(max(size, Self.sizes.lowerBound), Self.sizes.upperBound) } }
    var font = ReaderFont.parastoo
    var bold = true
    var layout = HemistichLayout.staggered
    var spacing = TextSpacing.loose
    var theme = ReaderTheme.paper

    init() {}

    /// Missing or unknown values fall back to the defaults, so older saved settings keep working.
    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        self.init()
        size = (try? values.decode(Int.self, forKey: .size)) ?? size
        font = (try? values.decode(ReaderFont.self, forKey: .font)) ?? font
        bold = (try? values.decode(Bool.self, forKey: .bold)) ?? bold
        layout = (try? values.decode(HemistichLayout.self, forKey: .layout)) ?? layout
        spacing = (try? values.decode(TextSpacing.self, forKey: .spacing)) ?? spacing
        theme = (try? values.decode(ReaderTheme.self, forKey: .theme)) ?? theme
    }

    var canChooseWeight: Bool { font == .parastoo }
    var postScript: String { font.postScript(bold: bold) }
    var glyphScale: CGFloat { font.glyphScale }
}

/// Holds the settings and keeps every change in UserDefaults.
@MainActor @Observable
final class TextSettingsStore {
    static let defaultsKey = "reader.textSettings"

    var settings: TextSettings {
        didSet { if let data = try? JSONEncoder().encode(settings) { defaults.set(data, forKey: Self.defaultsKey) } }
    }

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        settings = defaults.data(forKey: Self.defaultsKey)
            .flatMap { try? JSONDecoder().decode(TextSettings.self, from: $0) } ?? TextSettings()
    }
}
