import Foundation

/// `Friendship` of the contract: where I stand with someone. People are not followed any more; friends are made by
/// a request and its acceptance.
enum Friendship: String, Codable, Equatable, Sendable {
    case none
    /// I sent them a request and wait.
    case requested
    /// They sent me one.
    case incoming
    case friends

    /// The buttons this state shows, the main one first. A friend has none: «دوستین» is a chip, and removing them is
    /// in the ⋯ menu.
    var buttons: [FriendAction] {
        switch self {
        case .none: [.send]
        case .requested: [.cancel]
        case .incoming: [.accept, .reject]
        case .friends: []
        }
    }
}

/// What a person can do to a friendship, and the state each action moves it to (shown at once, then the server's
/// answer stands).
enum FriendAction: Hashable, Sendable {
    case send, cancel, accept, reject, unfriend

    /// The state it can be done in.
    var requires: Friendship {
        switch self {
        case .send: .none
        case .cancel: .requested
        case .accept, .reject: .incoming
        case .unfriend: .friends
        }
    }

    /// Painted as the main (lapis) button; «درخواست فرستادی», «رد» and the rest are grey.
    var isMain: Bool { self == .send || self == .accept }

    /// Taking a request back and rejecting one ask first; sending and accepting don't, and a friend is removed from the ⋯ menu,
    /// which asks on its own.
    var asksFirst: Bool { self == .cancel || self == .reject }

    var result: Friendship {
        switch self {
        case .send: .requested
        case .accept: .friends
        case .cancel, .reject, .unfriend: .none
        }
    }
}

/// The words of friend requests: the owner's copy (docs/yebeyt-2.md) and the lead's.
enum FriendCopy {
    static let friends = "دوستین"
    static let requestsTitle = "درخواست‌های دوستی"
    /// The section of requests I sent.
    static let sentSection = "فرستادی"
    /// The button of a request I sent, in that section.
    static let cancelSent = "لغو"
    static let confirmUnfriendButton = "حذف کن"
    static let slowDown = "یه کم بعد دوباره امتحان کن"
    static let noRequests = "درخواستی نداری."

    static func title(_ action: FriendAction) -> String {
        switch action {
        case .send: "درخواست دوستی"
        case .cancel: "درخواست فرستادی"
        case .accept: "قبول"
        case .reject: "رد"
        case .unfriend: "حذف از دوستا"
        }
    }

    static let cancelQuestion = "درخواستت رو پس بگیری؟"
    static let cancelConfirm = "پس بگیر"
    static let rejectQuestion = "درخواستش رو رد کنی؟"
    static let rejectNote = "بهش خبر نمی‌دیم."
    static let rejectConfirm = "رد کن"
    /// The safe button of both questions.
    static let keep = "نه"

    /// What the sheet asking before `action` says; nil for an action that doesn't ask.
    static func confirmation(for action: FriendAction) -> (title: String, message: String?, confirm: String)? {
        switch action {
        case .cancel: (cancelQuestion, nil, cancelConfirm)
        case .reject: (rejectQuestion, rejectNote, rejectConfirm)
        case .send, .accept, .unfriend: nil
        }
    }

    static func confirmUnfriend(name: String) -> String { "\(name) از دوستات حذف بشه؟" }

    static func accepted(by name: String) -> String { "\(name) درخواستت رو قبول کرد" }

    /// The line a failed call shows as a toast; the hourly limit on new requests is asked to wait.
    @MainActor static func toast(for error: APIError) -> String {
        let line = FeedbackLog.shared.shown(error)
        if case .server(let status, let code, _) = error, status == 429 || code == .rateLimited { return slowDown }
        return line
    }
}
