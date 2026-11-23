import Foundation
import Observation

/// What needs an account: the first use of it shows the account gate.
enum AccountFeature: String, Sendable {
    case likes, messages

    /// Fits «برای … یه حساب لازمه».
    var title: String {
        switch self {
        case .likes: "پسند و بازنشر"
        case .messages: "پیام دادن به دوستات"
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

    /// Runs `action` when there is an account; otherwise shows the gate, and runs it after sign-in
    /// (and the username, when there is none yet). «بعداً» drops it.
    func require(_ feature: AccountFeature, then action: @escaping @MainActor () -> Void) {
        if isSignedIn {
            action()
        } else {
            pending = action
            prompt = .gate(feature)
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
            await carryOverProgress()
            return .signedIn(needsUsername: signedIn.user.username == nil)
        } catch SignInError.canceled {
            return .canceled
        } catch let error as APIError {
            return .failed(error.persianMessage)
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

    /// «همینه»: saves the username and then the display name. Returns the line to show when it failed.
    func saveProfile(displayName: String, username: String) async -> String? {
        do {
            let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            let api = session.api
            var user = try await session.authorized { try await api.setUsername(username, token: $0) }
            if !name.isEmpty, name != user.displayName {
                user = try await session.authorized { try await api.setDisplayName(name, token: $0) }
            }
            session.update(user: user)
            providerName = nil
            return nil
        } catch let error as APIError {
            return error.persianMessage
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
