import Foundation

/// The words of the games with friends, kept in one place: the boards' copy and the lead's copy where a board has none.
enum PlayCopy {
    // MARK: Turn time

    /// The lobby's choices and the line in a game: «۳۰ ثانیه», «۲ دقیقه», «تا فردا».
    static func turnTime(seconds: Int) -> String {
        switch seconds {
        case 86_400: "تا فردا"
        case 120: "۲ دقیقه"
        default: "\(PersianDigits.string(seconds)) ثانیه"
        }
    }

    /// The time left: «۲۱ ساعت» (a game with a day to answer, while there is an hour or more, then «۴۵ دقیقه»), else «۰:۲۵».
    static func timeLeft(seconds: Int, turnSeconds: Int) -> String {
        guard turnSeconds >= 3600, seconds >= 60 else { return PersianDigits.clock(seconds) }
        if seconds >= 3600 { return "\(PersianDigits.string(seconds / 3600)) ساعت" }
        return "\(PersianDigits.string((seconds + 59) / 60)) دقیقه"
    }

    // MARK: مشاعره

    /// «نوبت توئه، با حرف «د»»
    static func myTurn(letter: Character) -> String { "نوبت توئه، با حرف «\(letter)»" }
    static let myTurnFirst = "نوبت توئه؛ بیت اول رو بگو"
    static func waiting(for name: String) -> String { name.isEmpty ? "منتظر دوستت…" : "منتظر \(name)…" }
    static let notFound = "این بیت رو پیدا نکردیم"

    /// «بردی!», «سارا برد», «مساوی»
    static func title(_ outcome: MoshState.Outcome, other: String) -> String {
        switch outcome {
        case .won: "بردی!"
        case .lost: "\(other) برد"
        case .draw: "مساوی"
        }
    }

    /// «با حرف «د» شروع نمی‌شه»
    static func wrongLetter(_ letter: Character?) -> String { letter.map { "با حرف «\($0)» شروع نمی‌شه" } ?? "با این حرف شروع نمی‌شه" }
    static let alreadyPlayed = "این بیت رو قبلاً گفتید"

    /// What a refused move says. The letter is the one the couplet had to start with.
    static func moveError(_ error: APIError, letter: Character?) -> String {
        switch error.code {
        case .wrongLetter: wrongLetter(letter)
        case .alreadyPlayed: alreadyPlayed
        case .turnOver: "وقتت تموم شد"
        case .badCouplet: "این بیت با متن گنجور نمی‌خونه"
        case .notYourTurn: "نوبت تو نیست"
        case .gameNotActive: "این بازی تموم شده"
        default: error.persianMessage
        }
    }

    /// What joining or making a game says when it fails.
    static func gameError(_ error: APIError) -> String {
        switch error.code {
        case .gameFull: "یکی دیگه زودتر اومده توی این بازی"
        case .notFound: "این بازی پیدا نشد"
        case .forbidden, .usernameRequired: "برای بازی با دوستات یه نام کاربری لازمه"
        default: error.persianMessage
        }
    }

    // MARK: Lobby

    /// «بیا مشاعره کنیم · https://yebeyt.com/g/M4R9»: what the link of a game is sent with.
    static func gameShare(game: String, url: String) -> String { "بیا \(game) کنیم · \(url)" }
    static let lobbyFooter = "هر کی اول اومد، بازی شروع می‌شه. تو هم اول می‌تونی بیت اول رو بگی."
    static let lobbyDuelFooter = "هر کی اول اومد، بازی شروع می‌شه."
    static let lobbyChallengeFooter = "اول خودت ۱۰ بیت رو بازی می‌کنی، بعد چالش برای دوستات می‌ره."
    /// Why somebody did not get the invitation: they take game invitations only from friends (`gameInvitesFrom`), or are not there.
    static func skipped(_ person: GameCreated.Skipped) -> String? {
        switch person.reason {
        case "friends_only": "\(person.username) فقط از دوستاش دعوت به بازی می‌گیره"
        case "not_found": "\(person.username) رو پیدا نکردیم"
        default: nil
        }
    }

    static let tooManyInvites = "حداکثر ۵ نفر رو می‌شه دعوت کرد"

    // MARK: Chat

    /// «سارا دعوتت کرد به مشاعره»
    static func invite(from name: String, game: String) -> String { "\(name) دعوتت کرد به \(game)" }
    static func invited(game: String) -> String { "دعوتش کردی به \(game)" }

    /// «سارا توی چالشت ۷ از ۱۰ گرفت»
    static func challengeResult(from name: String, score: Int) -> String { "\(name) توی چالشت \(PersianDigits.string(score)) از ۱۰ گرفت" }
    static func challengeResultMine(to name: String, score: Int) -> String { "توی چالش \(name) \(PersianDigits.string(score)) از ۱۰ گرفتی" }

    // MARK: Challenges

    /// «نیلوفر تو رو به جورچین بیت چالش کشید · yebeyt.com/c/7KQ2»: the chat message to a friend.
    static func challengeInvite(name: String, game: String, code: String) -> String {
        "\(name) تو رو به \(game) چالش کشید · \(challengeLink(code))"
    }

    /// «نیلوفر توی جورچین بیت ۸ از ۱۰ گرفت. تو چند می‌گیری؟»
    static func challengeBrag(name: String, game: String, score: Int) -> String {
        "\(name) توی \(game) \(PersianDigits.string(score)) از ۱۰ گرفت. تو چند می‌گیری؟"
    }

    /// The board of a challenge opened from a link (ChallengeAccept).
    static func fromLink(_ name: String) -> String { "از لینک \(name)" }
    static func waitingForYou(_ name: String) -> String { "\(name) منتظرته" }
    static let sameTen = "همون ۱۰ بیتی که اون بازی کرد."
    static func toWin(over score: Int) -> String { "بیشتر از \(PersianDigits.string(score)) تا بگیری، تو بردی." }
    static let aboutTwoMinutes = "حدود ۲ دقیقه"
    static let noAccount = "حساب نمی‌خواد"
    static func noAccountNote(_ name: String) -> String {
        "بازی کن؛ آخرش فقط یه اسم بنویس تا \(name) نتیجه‌ت رو ببینه. اگه خوشت اومد، می‌تونی بعداً حساب بسازی و با هم مشاعره کنید."
    }
    static func outOfTen(_ score: Int) -> String { "\(PersianDigits.string(score)) از ۱۰" }
    static let namePrompt = "اسمت چیه؟"
    static let nameNeeded = "یه اسم بنویس"
    static let challengePending = "چالش هنوز آماده نیست؛ یه لحظه صبر کن"
    static func challengeSentTo(_ name: String) -> String { "برای \(name) فرستاده شد" }
    static let challengeNotOpened = "این چالش باز نشد"
    static let challengeGone = "این چالش پیدا نشد یا تموم شده"
    /// «تو ۷ · نیلوفر ۸»
    static func scores(mine: Int, name: String, theirs: Int) -> String { "تو \(PersianDigits.string(mine)) · \(name) \(PersianDigits.string(theirs))" }

    static func challengeLink(_ code: String) -> String { "yebeyt.com/c/\(code)" }
    static func gameLink(_ code: String) -> String { "yebeyt.com/g/\(code)" }

    // MARK: رودررو

    static let answerNotSent = "جوابت نرسید؛ دوباره بزن"
    static func duelWaiting(for name: String) -> String { "منتظر \(name)…" }
    static func duelLeft(_ name: String) -> String { "\(name) رفت" }
    static func duelRound(winner: String?, me: String, otherName: String) -> String {
        guard let winner else { return "این دور کسی نبرد" }
        return winner == me ? "این دور رو بردی" : "\(otherName) این دور رو برد"
    }
}
