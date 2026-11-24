import Foundation
import Observation

/// What needs an account: the first use of it shows the account gate.
enum AccountFeature: String, Sendable {
    case likes, messages, invite, profile, leaderboard

    /// Fits «برای … یه حساب لازمه».
    var title: String {
        switch self {
        case .likes: "پسند و بازنشر"
        case .messages: "پیام دادن به دوستات"
        case .invite: "دعوت دوستات"
        case .profile: "همگام کردن دیوان و امتیازهات"
        case .leaderboard: "دیدن رده‌بندی"
        }
    }
}

/// Signing in and what follows it, for the gate and for onboarding: the provider's sheet, the server, the
/// carry-over of guest progress, the display name and username.
@MainActor @Observable
final class AccountModel {
    /// What the account sheet over the current screen shows.
    enum Prompt: Equatable {
        case gate(AccountFeature)
        case username
    }

    enum Outcome: Equatable {
        case signedIn(needsUsername: Bool)
        case canceled
        case failed(String)
    }

    let session: Session
    var prompt: Prompt?
    /// The provider of the sign-in just made, for the chip «با اپل وارد شدی».
    private(set) var provider: AuthProvider?
    /// The name the provider shared (Apple's full name, Google's profile name); only fills the name field.
    private(set) var providerName: String?
    private(set) var isSigningIn = false
    @ObservationIgnored private let credentials: CredentialSource
    @ObservationIgnored private let stats: GameStats
    @ObservationIgnored private var pending: (@MainActor () -> Void)?
    @ObservationIgnored private var isLookingUp = false

    init(session: Session, stats: GameStats, credentials: CredentialSource = SystemCredentialSource()) {
        self.session = session
        self.stats = stats
        self.credentials = credentials
    }

    var isSignedIn: Bool { session.isSignedIn }

    #if DEBUG
    /// `-beytSignedIn`: as if the person had just signed in with this provider and it had shared this name.
    func debugSignedIn(provider: AuthProvider, name: String?) {
        self.provider = provider
        providerName = name
    }
    #endif

    /// Runs `action` when there is an account with a username; shows the gate when there is no account, and the
    /// username step when there is an account without one. The action waits and runs when that is done; «بعداً»
    /// drops it. `needed: false` is for what a guest may still do (taking back a like).
    func require(_ feature: AccountFeature, needed: Bool = true, then action: @escaping @MainActor () -> Void) {
        guard needed else { return action() }
        if isSignedIn, session.user == nil {
            // Signed in, but the user is not loaded yet (a launch that has not finished restoring): load it first.
            // Taps while that is going on are ignored: only the first waiting action is kept.
            guard !isLookingUp else { return }
            isLookingUp = true
            Task {
                await session.restore()
                isLookingUp = false
                decide(feature, action)
            }
        } else {
            decide(feature, action)
        }
    }

    private func decide(_ feature: AccountFeature, _ action: @escaping @MainActor () -> Void) {
        if !isSignedIn {
            pending = action
            prompt = .gate(feature)
        } else if let user = session.user, user.username == nil {
            pending = action
            prompt = .username
        } else {
            action()  // an account with a username, or one that could not be looked up (no network): the server decides later
        }
    }

    /// The sheet is done: closes it and lets the waiting action go.
    func finishPrompt() {
        prompt = nil
        let action = pending
        pending = nil
        action?()
    }

    /// «بعداً» or a swipe down: the waiting action is dropped.
    func dismissPrompt() {
        prompt = nil
        pending = nil
    }

    /// The provider's sheet, then the server. Guest progress goes to the account right after.
    func signIn(with provider: AuthProvider) async -> Outcome {
        guard !isSigningIn else { return .canceled }
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            let result = try await credentials.signIn(with: provider)
            let api = session.api
            let signedIn: APISession
            switch result.credential {
            case .apple(let identityToken, let code, let nonce):
                signedIn = try await api.signInWithApple(identityToken: identityToken, authorizationCode: code, nonce: nonce)
            case .google(let idToken):
                signedIn = try await api.signInWithGoogle(idToken: idToken)
            }
            session.apply(signedIn)
            self.provider = provider
            providerName = result.name
            if stats.claim(for: signedIn.user.id) { await carryOverProgress() }  // another account's points are not carried over
            return .signedIn(needsUsername: signedIn.user.username == nil)
        } catch SignInError.canceled {
            return .canceled
        } catch let error as APIError {
            return .failed(FeedbackLog.shared.shown(error))
        } catch {
            return .failed(APIError.badResponse.persianMessage)
        }
    }

    /// The gate's buttons: signs in and then either goes on to the username or lets the action go.
    /// Returns the line to show when it failed.
    func signInFromGate(with provider: AuthProvider) async -> String? {
        switch await signIn(with: provider) {
        case .signedIn(let needsUsername):
            if needsUsername { prompt = .username } else { finishPrompt() }
            return nil
        case .canceled: return nil
        case .failed(let message): return message
        }
    }

    /// «همینه»: saves the display name, then the username (the one that can be refused), so a name that fails leaves
    /// nothing half done and a taken username can be fixed and sent again. Returns the line to show when it failed.
    func saveProfile(displayName: String, username: String) async -> String? {
        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if let problem = DisplayNameRules.problem(name) { return problem.message }
        do {
            let api = session.api
            if !name.isEmpty, name != session.user?.displayName {
                session.update(user: try await session.authorized { try await api.setDisplayName(name, token: $0) })
            }
            session.update(user: try await session.authorized { try await api.setUsername(username, token: $0) })
            providerName = nil
            return nil
        } catch let error as APIError {
            return FeedbackLog.shared.shown(error)
        } catch {
            return APIError.badResponse.persianMessage
        }
    }

    /// Guest progress is merged into the account (the server keeps the larger values, so repeating is harmless).
    /// A failure is not shown: the points stay on the phone.
    private func carryOverProgress() async {
        let payload = ProgressPayload(stats: stats)
        guard !payload.isEmpty else { return }
        let api = session.api
        try? await session.authorized { try await api.putProgress(payload, token: $0) }
    }
}
