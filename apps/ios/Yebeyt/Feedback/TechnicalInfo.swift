import Foundation
import UIKit

/// The screens that can be named in a report: a fixed list, so a name is never typed text. Bug reports send the
/// name of the screen and the names of the last screens visited (`FeedbackLog`).
enum ScreenName: String, Sendable, CaseIterable {
    case home = "خونه"
    case explore = "کاوش"
    case games = "بازی"
    case messages = "پیام‌ها"
    case me = "من"
    case library = "کتابخونه"
    case book = "کتاب"
    case section = "بخش کتاب"
    case poet = "صفحه‌ی شاعر"
    case search = "جست‌وجو"
    case mood = "موضوع"
    case allPoets = "همه‌ی شاعرها"
    case gamesCatalog = "همه‌ی بازی‌ها"
    case divan = "دیوان"
    case privacy = "حریم خصوصی"
    case avatar = "چهره"
    case invite = "دعوت دوستان"
    case settings = "تنظیمات"
    case badges = "نشان‌ها"
    case licenses = "مجوزها"
    case chat = "گفتگو"
    case sharedDivan = "دیوان مشترک"
    case people = "پیدا کردن دوست"
    case person = "صفحه‌ی یه آدم"
    case leaderboard = "رده‌بندی"
    case friends = "دوستا"
    case friendRequests = "درخواست‌های دوستی"
    case reader = "خوندن شعر"
    case daily = "معمای امروز"
    case jigsaw = "جورچین بیت"
    case poetGame = "حدس شاعر"
    case second = "مصراع دوم"
    case bookGame = "از کدوم کتاب؟"
    case match = "معنی‌یاب"
    case listen = "گوش کن"
    case lobby = "بازی با دوست"
    case mosh = "مشاعره"
    case duel = "بازی رودررو"
    case challenge = "چالش"

    init(_ tab: Tab) {
        switch tab {
        case .home: self = .home
        case .explore: self = .explore
        case .games: self = .games
        case .messages: self = .messages
        case .me: self = .me
        }
    }

    init(_ destination: Destination) {
        switch destination {
        case .library: self = .library
        case .book: self = .book
        case .section: self = .section
        case .poet: self = .poet
        case .search: self = .search
        case .mood: self = .mood
        case .allPoets: self = .allPoets
        case .gamesCatalog: self = .gamesCatalog
        case .divan: self = .divan
        case .privacy: self = .privacy
        case .avatar: self = .avatar
        case .invite: self = .invite
        case .settings: self = .settings
        case .badges: self = .badges
        case .licenses: self = .licenses
        case .chat: self = .chat
        case .sharedDivan: self = .sharedDivan
        case .people: self = .people
        case .person: self = .person  // never the username
        case .leaderboard: self = .leaderboard
        case .friends: self = .friends
        case .friendRequests: self = .friendRequests
        }
    }

    init(_ game: GameRoute) {
        switch game {
        case .daily: self = .daily
        case .jigsaw: self = .jigsaw
        case .match: self = .match
        case .lobby: self = .lobby
        case .mosh: self = .mosh
        case .duel: self = .duel
        case .challenge: self = .challenge
        case .challengeRound(let game, _): self = game == .jigsaw ? .jigsaw : .poetGame
        case .quiz(let start):
            switch start {
            case .poet, .poetItems: self = .poetGame
            case .misra: self = .second
            case .book: self = .bookGame
            case .listen: self = .listen
            }
        }
    }
}

/// `technical.network` of the contract.
enum NetworkKind: String, Sendable {
    case wifi, cellular, offline, unknown

    init(satisfied: Bool, wifi: Bool, cellular: Bool) {
        if !satisfied { self = .offline } else if wifi { self = .wifi } else if cellular { self = .cellular } else { self = .unknown }
    }

    var title: String {
        switch self {
        case .wifi: "وای‌فای"
        case .cellular: "اینترنت گوشی"
        case .offline: "بدون اینترنت"
        case .unknown: "نامشخص"
        }
    }
}

/// `technical.accountState` of the contract.
enum AccountState: String, Sendable {
    case guest, signedIn

    var title: String { self == .guest ? "مهمان" : "واردشده" }
}

/// A value of `technical.textSettings`: a short string, a number or a switch.
enum SettingValue: Encodable, Equatable, Sendable {
    case text(String)
    case number(Double)
    case flag(Bool)

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let value): try container.encode(String(value.prefix(40)))
        case .number(let value): try container.encode(value)
        case .flag(let value): try container.encode(value)
        }
    }

    var display: String {
        switch self {
        case .text(let value): value
        case .number(let value): PersianDigits.convert(value == value.rounded() ? String(Int(value)) : String(value))
        case .flag(let value): value ? "بله" : "نه"
        }
    }
}

/// `technical` of the contract: the only things a bug report may say about the phone's state. Never typed text,
/// messages, a phone number, an address or a place. The screen can see exactly this under «ببین چیه».
struct TechnicalInfo: Encodable, Equatable, Sendable {
    /// The keys the server allows (`FeedbackTechnical`); a test keeps the encoding inside this list.
    static let allowedKeys: Set<String> = [
        "screen", "couplet", "mode", "recitationPosition", "textSettings", "network", "accountState", "recentErrors", "steps",
    ]
    static let listLimit = 20

    var screen: ScreenName
    /// `<poemPath>#<coupletIndex>` while a reader is open.
    var couplet: String?
    var mode: String?
    /// Seconds into the recitation.
    var recitationPosition: Double?
    var textSettings: [String: SettingValue]
    var network: NetworkKind
    var accountState: AccountState
    /// Codes such as «429 rate_limited», never messages.
    var recentErrors: [String]
    var steps: [ScreenName]

    /// A reader position as the contract writes it, or nil for a path or index it would refuse.
    static func coupletKey(path: String, index: Int) -> String? {
        let key = "\(path)#\(index)"
        guard key.count <= 200, key.range(of: #"^/[a-z0-9_\-/]+#\d{1,5}$"#, options: .regularExpression) != nil else { return nil }
        return key
    }

    enum CodingKeys: String, CodingKey {
        case screen, couplet, mode, recitationPosition, textSettings, network, accountState, recentErrors, steps
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(screen.rawValue, forKey: .screen)
        try container.encodeIfPresent(couplet, forKey: .couplet)
        try container.encodeIfPresent(mode, forKey: .mode)
        try container.encodeIfPresent(recitationPosition, forKey: .recitationPosition)
        if !textSettings.isEmpty { try container.encode(textSettings, forKey: .textSettings) }
        try container.encode(network.rawValue, forKey: .network)
        try container.encode(accountState.rawValue, forKey: .accountState)
        if !recentErrors.isEmpty { try container.encode(recentErrors.suffix(Self.listLimit).map { String($0.prefix(200)) }, forKey: .recentErrors) }
        if !steps.isEmpty { try container.encode(steps.suffix(Self.listLimit).map(\.rawValue), forKey: .steps) }
    }

    /// One line of the «ببین چیه» list.
    struct Row: Equatable, Sendable {
        var label: String
        var value: String
    }

    /// The same facts as `encode`, in Persian: what the person sees is what is sent.
    var rows: [Row] {
        var rows = [Row(label: "صفحه", value: screen.rawValue)]
        if let couplet { rows.append(Row(label: "بیت", value: couplet)) }
        if let mode { rows.append(Row(label: "حالت خوندن", value: mode)) }
        if let recitationPosition { rows.append(Row(label: "جای خوانش", value: PersianDigits.convert(String(Int(recitationPosition))) + " ثانیه")) }
        for (key, value) in textSettings.sorted(by: { Self.settingOrder($0.key) < Self.settingOrder($1.key) }) {
            rows.append(Row(label: "متن · \(Self.settingLabels[key] ?? key)", value: value.display))
        }
        rows.append(Row(label: "اینترنت", value: network.title))
        rows.append(Row(label: "حساب", value: accountState.title))
        rows.append(Row(label: "خطاهای اخیر", value: recentErrors.isEmpty ? "هیچی" : recentErrors.suffix(Self.listLimit).joined(separator: "، ")))
        rows.append(Row(label: "کارهای قبلش", value: steps.isEmpty ? "هیچی" : steps.suffix(Self.listLimit).map(\.rawValue).joined(separator: "، ")))
        return rows
    }

    private static let settingLabels = ["size": "اندازه", "font": "قلم", "bold": "پررنگ", "layout": "چیدمان", "spacing": "فاصله", "theme": "زمینه"]
    private static func settingOrder(_ key: String) -> Int { ["size", "font", "bold", "layout", "spacing", "theme"].firstIndex(of: key) ?? 99 }
}

extension TextSettings {
    /// The «آ» sheet's choices as `technical.textSettings`.
    var technicalValues: [String: SettingValue] {
        ["size": .number(Double(size)), "font": .text(font.title), "bold": .flag(bold), "layout": .text(layout.title),
         "spacing": .text(spacing.title), "theme": .text(theme.title)]
    }
}

extension ReaderMode {
    var technicalTitle: String { self == .couplet ? "بیت به بیت" : "کل شعر" }
}

/// App version, phone model and system version: they go with every report, silently.
struct DeviceInfo: Equatable, Sendable {
    var appVersion: String
    var deviceModel: String
    var osVersion: String

    /// `iPhone16,2`, the machine id from `utsname`.
    static func machineID() -> String {
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { buffer in
            String(decoding: buffer.prefix { $0 != 0 }, as: UTF8.self)
        }
    }

    @MainActor static func current(bundle: Bundle = .main) -> DeviceInfo {
        DeviceInfo(
            appVersion: String((bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "2.0.0").prefix(20)),
            deviceModel: String(machineID().prefix(40)),
            osVersion: String(UIDevice.current.systemVersion.prefix(20))
        )
    }
}
