import Foundation

/// The five kinds of feedback. The raw value is the `type` of `POST /v1/feedback`.
enum FeedbackType: String, CaseIterable, Identifiable, Sendable {
    case bug, annoyed, idea, game, liked

    var id: String { rawValue }

    /// The order of the rows on the board's sheet.
    static let menuOrder: [FeedbackType] = [.bug, .idea, .game, .liked, .annoyed]

    var title: String {
        switch self {
        case .bug: "باگ دیدم"
        case .annoyed: "یه جاش اذیتم کرد"
        case .idea: "یه ایده دارم"
        case .game: "یه بازی پیشنهاد بدم"
        case .liked: "خوشم اومد"
        }
    }

    var subtitle: String {
        switch self {
        case .bug: "یه چیزی درست کار نمی‌کنه"
        case .annoyed: "انتقادت رو بی‌تعارف بگو"
        case .idea: "چیزی که اپ رو بهتر کنه"
        case .game: "بازی‌ای که دلت می‌خواد توی «یه بیت» باشه"
        case .liked: "بگو چی رو دوست داشتی"
        }
    }

    /// The «تازه» tag on the board's sheet.
    var isNew: Bool { self == .game }

    /// The docs table: bug and annoyed take a screenshot (switch on), an idea may (switch off), the rest never.
    var screenshotDefault: Bool? {
        switch self {
        case .bug, .annoyed: true
        case .idea: false
        case .game, .liked: nil
        }
    }

    var takesScreenshot: Bool { screenshotDefault != nil }
    var sendsScreen: Bool { self == .bug || self == .annoyed }
    var sendsTechnical: Bool { self == .bug }
    var takesRecording: Bool { self == .bug }
}

/// «چند بار پیش اومده؟»
enum FeedbackFrequency: String, CaseIterable, Sendable {
    case always, sometimes, once

    var title: String {
        switch self {
        case .always: "همیشه"
        case .sometimes: "گاهی"
        case .once: "یه بار"
        }
    }
}

/// «با کی بازی می‌شه؟»
enum FeedbackPlayers: String, CaseIterable, Sendable {
    case solo, friends, both

    var title: String {
        switch self {
        case .solo: "تنها"
        case .friends: "با دوست"
        case .both: "هر دو"
        }
    }
}

/// What the person has filled in. `text` is the main field: «چی شد؟» for a bug, «چطوری بازی می‌شه؟» for a game idea.
struct FeedbackDraft: Equatable, Sendable {
    static let textLimit = 2000
    static let nameLimit = 60

    let type: FeedbackType
    var text = ""
    var frequency = FeedbackFrequency.sometimes
    var gameName = ""
    var players = FeedbackPlayers.solo
    var screenshotOn: Bool

    init(type: FeedbackType) {
        self.type = type
        screenshotOn = type.screenshotDefault ?? false
    }

    var trimmedText: String { String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.textLimit)) }

    /// Something was typed: the text, or the name of a game idea.
    var hasTypedText: Bool { !trimmedText.isEmpty || !gameName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    /// The send button waits for the required text.
    var canSend: Bool { !trimmedText.isEmpty }

    /// Whether a screenshot goes with the report: the type takes one and the switch is on.
    var sendsScreenshot: Bool { type.takesScreenshot && screenshotOn }
}

/// The body of `POST /v1/feedback`, shaped by the rules of the type (`FeedbackRequest` in packages/api/openapi.json).
struct FeedbackPayload: Encodable, Equatable, Sendable {
    struct GameIdea: Encodable, Equatable, Sendable {
        var name: String?
        var how: String
        var players: String
    }

    var type: String
    var text: String?
    var frequency: String?
    var game: GameIdea?
    var screen: String?
    var technical: TechnicalInfo?
    var appVersion: String
    var deviceModel: String
    var osVersion: String

    /// `info` is what the phone knew when the person asked to give feedback; only the parts the type takes are used.
    init(draft: FeedbackDraft, info: TechnicalInfo, device: DeviceInfo) {
        let type = draft.type
        self.type = type.rawValue
        if type == .game {
            let name = String(draft.gameName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(FeedbackDraft.nameLimit))
            game = GameIdea(name: name.isEmpty ? nil : name, how: draft.trimmedText, players: draft.players.rawValue)
        } else {
            text = draft.trimmedText
        }
        frequency = type == .bug ? draft.frequency.rawValue : nil
        screen = type.sendsScreen ? info.screen.rawValue : nil
        technical = type.sendsTechnical ? info : nil
        appVersion = device.appVersion
        deviceModel = device.deviceModel
        osVersion = device.osVersion
    }
}
