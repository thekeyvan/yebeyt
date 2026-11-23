import Foundation
import Observation

/// The screens of onboarding, in order. The raw value is the name of the `-beytOnboarding` debug launch argument.
enum OnboardingStep: String, CaseIterable, Sendable {
    case welcome, taste, game, account, username, friends

    /// The place in the bar «سلیقه · اولین بازی · حساب»; the other screens have no bar.
    var barIndex: Int? {
        switch self {
        case .taste: 0
        case .game: 1
        case .account: 2
        case .welcome, .username, .friends: nil
        }
    }
}

/// Where onboarding is: welcome → taste → a 30-second game → account → username → friends. «رد شو» goes one
/// step on; the account step ends it. Onboarding is shown on the first launch only, and only once.
@MainActor @Observable
final class OnboardingModel {
    static let doneKey = "onboarding.done"

    /// The screen in front; nil when onboarding is not running.
    private(set) var step: OnboardingStep?
    /// The game was won: the account step shows «آفرین! +۵۰».
    private(set) var gameWon = false
    @ObservationIgnored private let defaults: UserDefaults

    init(start: OnboardingStep?, gameWon: Bool = false, defaults: UserDefaults = .standard) {
        self.step = start
        self.gameWon = gameWon
        self.defaults = defaults
    }

    /// The first screen of a launch: the welcome until onboarding has been finished once.
    static func firstLaunchStep(defaults: UserDefaults = .standard) -> OnboardingStep? {
        defaults.bool(forKey: doneKey) ? nil : .welcome
    }

    var isRunning: Bool { step != nil }

    /// «بزن بریم», «بعدی», «رد شو»: the next screen in line; the account step ends it.
    func next() {
        switch step {
        case .welcome: step = .taste
        case .taste: step = .game
        case .game: step = .account
        case .account, .friends: finish()
        case .username: step = .friends
        case nil: break
        }
    }

    /// «از قبل حساب داری؟ وارد شو».
    func signIn() {
        if step == .welcome { step = .account }
    }

    /// The game ended; the account step follows.
    func gameEnded(won: Bool) {
        guard step == .game else { return }
        gameWon = won
        step = .account
    }

    /// Signed in on the account step: a new account picks its username, one that has it is done.
    func signedIn(needsUsername: Bool) {
        guard step == .account else { return }
        if needsUsername { step = .username } else { finish() }
    }

    /// «فعلاً بدون حساب», «بریم خونه», «بعداً».
    func finish() {
        defaults.set(true, forKey: Self.doneKey)
        step = nil
    }
}
