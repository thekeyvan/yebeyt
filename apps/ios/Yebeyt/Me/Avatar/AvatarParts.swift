import Foundation

/// The six parts of a face, each an id from `AvatarCatalogue` (a short lower-case word, as the contract wants:
/// letters, digits and dashes, up to 32).
struct AvatarParts: Codable, Equatable, Sendable {
    var face: String
    var eyes: String
    var hair: String
    var mouth: String
    var accessory: String
    var background: String

    /// The board's face, which everyone starts with.
    static let standard = AvatarParts(face: "peach", eyes: "round", hair: "dark", mouth: "smile", accessory: "ney", background: "sun")

    /// What VoiceOver says for the face: «چهره‌ی تو، با نیِ مولانا» (the board's label).
    var spoken: String {
        guard let item = Accessory(rawValue: accessory), item != .none else { return "چهره‌ی تو" }
        return "چهره‌ی تو، با \(item.title)"
    }

    subscript(part: AvatarPart) -> String {
        get {
            switch part {
            case .face: face
            case .eyes: eyes
            case .hair: hair
            case .mouth: mouth
            case .accessory: accessory
            case .background: background
            }
        }
        set {
            switch part {
            case .face: face = newValue
            case .eyes: eyes = newValue
            case .hair: hair = newValue
            case .mouth: mouth = newValue
            case .accessory: accessory = newValue
            case .background: background = newValue
            }
        }
    }
}

/// The chips of the Avatar screen, in board order (the first sits at the right).
enum AvatarPart: String, CaseIterable, Sendable {
    case face, eyes, hair, mouth, accessory, background

    var title: String {
        switch self {
        case .face: "صورت"
        case .eyes: "چشم"
        case .hair: "مو"
        case .mouth: "دهن"
        case .accessory: "کلاه و همراه"
        case .background: "زمینه"
        }
    }
}

struct AvatarOption: Identifiable, Equatable, Sendable {
    let id: String
    /// Read out by VoiceOver; the tiles show a swatch or a small face.
    let title: String
}

/// What the phone knows about the player that opens the locked accessories.
struct AvatarProgress: Equatable, Sendable {
    var bookWins = 0
    var bestStreak = 0
}

/// The accessories of the board, the first six items of the grid.
enum Accessory: String, CaseIterable, Sendable {
    case none, ney, rose, crown, helmet, candle

    enum Unlock: Equatable, Sendable {
        case bookWins(Int)
        case streak(Int)
        /// Until leagues exist (slice 7).
        case league
    }

    var title: String {
        switch self {
        case .none: "هیچی"
        case .ney: "نیِ مولانا"
        case .rose: "گل سرخِ حافظ"
        case .crown: "تاجِ شاهنامه"
        case .helmet: "کلاه‌خودِ رستم"
        case .candle: "شمع و پروانه"
        }
    }

    var unlock: Unlock? {
        switch self {
        case .none, .ney, .rose: nil
        case .crown: .bookWins(5)
        case .helmet: .league
        case .candle: .streak(7)
        }
    }

    /// The line under the name of a locked item, as on the board.
    var unlockText: String? {
        switch unlock {
        case nil: nil
        case .bookWins(let count): "\(PersianDigits.string(count)) برد توی «از کدوم کتاب؟»"
        case .streak(let days): "\(PersianDigits.string(days)) روز پشت‌سرهم"
        case .league: "لیگ سخن‌دان"
        }
    }

    func isUnlocked(_ progress: AvatarProgress) -> Bool {
        switch unlock {
        case nil: true
        case .bookWins(let count): progress.bookWins >= count
        case .streak(let days): progress.bestStreak >= days
        case .league: false
        }
    }

    /// The card under the grid: «نیِ مولانا · مثنوی» and a couplet of it. Nothing for «هیچی» and for the helmet,
    /// which stays locked.
    var card: (source: String, couplet: String)? {
        switch self {
        case .none, .helmet: nil
        case .ney: ("نیِ مولانا · مثنوی", "بشنو این نی چون شکایت می‌کند")
        case .rose: ("گل سرخِ حافظ · دیوان حافظ", "دلت به وصل گل ای بلبل صبا خوش باد")
        case .crown: ("تاجِ شاهنامه · شاهنامه", "جهاندار هوشنگ با رای و داد")
        case .candle: ("شمع و پروانه · دیوان عطار", "عشق جانان همچو شمعم از قدم تا سر بسوخت")
        }
    }
}

/// The parts and their choices. Skin, hair and background are colours; eyes and mouth have three variants.
enum AvatarCatalogue {
    static let skins: [(id: String, title: String, hex: UInt32)] = [
        ("peach", "هلویی", 0xF2C29B), ("sand", "شنی", 0xE8B98A), ("tan", "برنزه", 0xC98F63), ("brown", "قهوه‌ای", 0x9C6A45), ("ivory", "عاجی", 0xF8DCC4),
    ]
    static let hairs: [(id: String, title: String, hex: UInt32)] = [
        ("dark", "قهوه‌ای تیره", 0x3B2A2A), ("black", "مشکی", 0x14112B), ("amber", "زرد", 0xFFB703), ("fire", "نارنجی", 0xFF4D24),
        ("magenta", "صورتی", 0xFF3D8B), ("lapis", "لاجوردی", 0x2F35F5),
    ]
    static let backgrounds: [(id: String, title: String, hex: UInt32)] = [
        ("sun", "آفتابی", 0xFFE08A), ("sky", "آسمانی", 0xE8E9FF), ("mint", "نعنایی", 0xBDEBA3), ("rose", "گلی", 0xFFC2DA),
        ("paper", "کاغذی", 0xF1EFEA), ("lapis", "لاجوردی", 0x2F35F5),
    ]
    static let eyes = [AvatarOption(id: "round", title: "گرد"), AvatarOption(id: "happy", title: "خندان"), AvatarOption(id: "wink", title: "چشمک")]
    static let mouths = [AvatarOption(id: "smile", title: "لبخند"), AvatarOption(id: "grin", title: "خنده"), AvatarOption(id: "calm", title: "آروم")]

    static func options(for part: AvatarPart) -> [AvatarOption] {
        switch part {
        case .face: skins.map { AvatarOption(id: $0.id, title: $0.title) }
        case .eyes: eyes
        case .hair: hairs.map { AvatarOption(id: $0.id, title: $0.title) }
        case .mouth: mouths
        case .accessory: Accessory.allCases.map { AvatarOption(id: $0.rawValue, title: $0.title) }
        case .background: backgrounds.map { AvatarOption(id: $0.id, title: $0.title) }
        }
    }

    static func skin(_ id: String) -> UInt32 { skins.first { $0.id == id }?.hex ?? skins[0].hex }
    static func hair(_ id: String) -> UInt32 { hairs.first { $0.id == id }?.hex ?? hairs[0].hex }
    static func background(_ id: String) -> UInt32 { backgrounds.first { $0.id == id }?.hex ?? backgrounds[0].hex }

    /// Whether every part is an id of the catalogue (a saved or server face that isn't is replaced by the default).
    static func isValid(_ parts: AvatarParts) -> Bool {
        AvatarPart.allCases.allSatisfy { part in options(for: part).contains { $0.id == parts[part] } }
    }

    /// The face with `option` chosen for `part`, when that is allowed: a locked accessory can't be chosen.
    static func choosing(_ option: String, for part: AvatarPart, in parts: AvatarParts, progress: AvatarProgress) -> AvatarParts? {
        guard options(for: part).contains(where: { $0.id == option }) else { return nil }
        if part == .accessory, let accessory = Accessory(rawValue: option), !accessory.isUnlocked(progress) { return nil }
        var result = parts
        result[part] = option
        return result
    }
}
