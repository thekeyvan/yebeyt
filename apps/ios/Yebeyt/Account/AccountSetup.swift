import Foundation

/// The accounts side of the app, built once at launch: the session, the sign-in flow, the poet pictures, the
/// taste and onboarding. Debug launch arguments (`AccountLaunchOptions`) shape it for screenshots and tests.
@MainActor
struct AccountSetup {
    let session: Session
    let account: AccountModel
    let pictures: PoetPictures
    let taste: Taste
    let onboarding: OnboardingModel

    init(stats: GameStats, defaults: UserDefaults = .standard) {
        let session: Session
        let start: OnboardingStep?
        #if DEBUG
        let options = AccountLaunchOptions.fromProcess
        if options.fresh { Self.forgetEverything(in: defaults) }
        let api = options.makeAPI()
        session = options.signedIn ? Session(api: api, store: KeychainStore(), fake: AccountLaunchOptions.debugUser) : Session(api: api)
        start = options.onboarding
        #else
        let api = API.configured()
        session = Session(api: api)
        start = OnboardingModel.firstLaunchStep(defaults: defaults)
        #endif
        self.session = session
        account = AccountModel(session: session, stats: stats)
        pictures = PoetPictures(api: session.api)
        taste = Taste(defaults: defaults)
        #if DEBUG
        onboarding = OnboardingModel(start: start, gameWon: start == .account, defaults: defaults)  // the account screen as drawn: after a win
        #else
        onboarding = OnboardingModel(start: start, defaults: defaults)
        #endif
        #if DEBUG
        if options.signedIn { account.debugSignedIn(provider: .apple, name: "نیلوفر") }
        if let gate = options.gate, !session.isSignedIn { account.prompt = .gate(gate) }
        #endif
    }

    #if DEBUG
    /// `-beytFresh 1`: signed out, nothing picked, onboarding not done.
    static func forgetEverything(in defaults: UserDefaults) {
        [Taste.poetsKey, Taste.moodsKey, OnboardingModel.doneKey].forEach(defaults.removeObject(forKey:))
        KeychainStore().delete()
    }
    #endif
}
