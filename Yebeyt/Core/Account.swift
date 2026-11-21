import Foundation
import AuthenticationServices
import GoogleSignIn
import Observation
import Security
import UIKit

/// Optional sign-in (Apple or Google). When signed in, the reader's divan, history and streak
/// follow them to every device through the yebeyt server.
@Observable
final class Account {
    struct User: Codable, Equatable {
        let id: String
        let name: String?
        let email: String?
    }

    struct Identity: Codable, Equatable, Hashable {
        let provider: String
        let email: String?
    }

    enum Phase: Equatable { case signedOut, working, signedIn }

    private(set) var user: User?
    private(set) var identities: [Identity] = []
    private(set) var phase: Phase = .signedOut
    private(set) var lastSync: Date?
    var error: String?

    @ObservationIgnored private var token: String? { didSet { Keychain.set(token, for: "session") } }
    @ObservationIgnored private weak var prefs: Prefs?
    @ObservationIgnored private var syncTask: Task<Void, Never>?
    @ObservationIgnored private var applying = false

    static let api: URL? = (Bundle.main.object(forInfoDictionaryKey: "BeytAPIURL") as? String).flatMap { $0.isEmpty ? nil : URL(string: $0) }
    static let googleClientID: String? = (Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String).flatMap { $0.isEmpty ? nil : $0 }
    var googleAvailable: Bool { Account.googleClientID != nil }

    init() {
        token = Keychain.get("session")
        if token != nil, let d = UserDefaults.standard.data(forKey: "beyt.user"), let u = try? JSONDecoder().decode(User.self, from: d) {
            user = u
            phase = .signedIn
            if let d = UserDefaults.standard.data(forKey: "beyt.identities"), let ids = try? JSONDecoder().decode([Identity].self, from: d) { identities = ids }
        }
    }

    func isConnected(_ provider: String) -> Bool { identities.contains { $0.provider == provider } }

    private struct MeResponse: Decodable { let user: User?; let identities: [Identity]? }
    private struct SignInResponse: Decodable { let token: String; let user: User; let identities: [Identity]? }

    @MainActor private func apply(user u: User?, identities ids: [Identity]?) {
        if let u {
            user = u
            UserDefaults.standard.set(try? JSONEncoder().encode(u), forKey: "beyt.user")
        }
        if let ids {
            identities = ids
            UserDefaults.standard.set(try? JSONEncoder().encode(ids), forKey: "beyt.identities")
        }
    }

    /// Hooks into settings so every change is synced (debounced).
    @MainActor
    func attach(_ prefs: Prefs) {
        self.prefs = prefs
        prefs.onChange = { [weak self] in
            guard let self, !self.applying, self.phase == .signedIn else { return }
            self.scheduleSync()
        }
        if phase == .signedIn { Task { await refreshMe(); await sync() } }
    }

    // MARK: sign in

    /// Sign in with Apple: called with the button's result.
    @MainActor
    func handleApple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let e):
            if (e as? ASAuthorizationError)?.code != .canceled { error = "ورود با اپل انجام نشد." }
        case .success(let auth):
            guard let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let data = cred.identityToken, let idToken = String(data: data, encoding: .utf8) else {
                error = "ورود با اپل انجام نشد."; return
            }
            let name = [cred.fullName?.givenName, cred.fullName?.familyName].compactMap { $0 }.joined(separator: " ")
            let code = cred.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            await signIn(path: "v1/auth/apple", body: ["identityToken": idToken, "authorizationCode": code, "name": name])
        }
    }

    @MainActor
    func signInWithApple() async {
        guard let body = await appleBody(signingIn: true) else { return }
        await signIn(path: "v1/auth/apple", body: body)
    }

    @MainActor
    func signInWithGoogle() async {
        guard let body = await googleBody() else { return }
        await signIn(path: "v1/auth/google", body: body)
    }

    /// Runs Google Sign-In and returns the body for our server, or nil (cancelled / failed).
    @MainActor
    private func googleBody() async -> [String: String]? {
        guard let id = Account.googleClientID else { return nil }
        guard let root = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first?.rootViewController else { return nil }
        var top = root
        while let p = top.presentedViewController { top = p }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: id)
        do {
            let r = try await GIDSignIn.sharedInstance.signIn(withPresenting: top)
            guard let idToken = r.user.idToken?.tokenString else { error = "ورود با گوگل انجام نشد."; return nil }
            return ["idToken": idToken]
        } catch {
            if (error as NSError).code != GIDSignInError.canceled.rawValue { self.error = "ورود با گوگل انجام نشد." }
            return nil
        }
    }

    /// Runs Sign in with Apple without the system button (used to connect Apple to an account).
    @MainActor
    private func appleBody(signingIn: Bool = false) async -> [String: String]? {
        do {
            let cred = try await AppleAuth.request()
            guard let data = cred.identityToken, let idToken = String(data: data, encoding: .utf8) else { error = signingIn ? "ورود با اپل انجام نشد." : "اتصال اپل انجام نشد."; return nil }
            let name = [cred.fullName?.givenName, cred.fullName?.familyName].compactMap { $0 }.joined(separator: " ")
            let code = cred.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            return ["identityToken": idToken, "authorizationCode": code, "name": name]
        } catch {
            if (error as? ASAuthorizationError)?.code != .canceled { self.error = signingIn ? "ورود با اپل انجام نشد." : "اتصال اپل انجام نشد." }
            return nil
        }
    }

    // MARK: connected sign-ins

    /// Connects Apple or Google to the signed-in account. If that login had its own account, they're merged.
    @MainActor
    func connect(_ provider: String) async -> Bool {
        let body = provider == "apple" ? await appleBody() : await googleBody()
        guard let body else { return false }
        struct R: Decodable { let result: String; let user: User?; let identities: [Identity]? }
        do {
            let r: R = try await request("v1/me/identities/\(provider)", method: "POST", body: body)
            apply(user: r.user, identities: r.identities)
            await sync()
            return true
        } catch {
            self.error = "اتصال انجام نشد. دوباره امتحان کن."
            return false
        }
    }

    @MainActor
    func disconnect(_ provider: String) async {
        do {
            let r: MeResponse = try await request("v1/me/identities/\(provider)", method: "DELETE")
            apply(user: r.user, identities: r.identities)
            if provider == "google" { GIDSignIn.sharedInstance.signOut() }
        } catch {
            self.error = "قطع اتصال انجام نشد."
        }
    }

    @MainActor
    func refreshMe() async {
        guard phase == .signedIn, let r: MeResponse = try? await request("v1/me") else { return }
        apply(user: r.user, identities: r.identities)
    }

    @MainActor
    private func signIn(path: String, body: [String: String]) async {
        phase = .working
        error = nil
        do {
            let r: SignInResponse = try await request(path, method: "POST", body: body, auth: false)
            token = r.token
            apply(user: r.user, identities: r.identities)
            phase = .signedIn
            await sync()
        } catch {
            phase = .signedOut
            self.error = "ورود انجام نشد. اینترنت رو چک کن و دوباره امتحان کن."
        }
    }

    @MainActor
    func signOut() {
        syncTask?.cancel()
        token = nil
        user = nil
        identities = []
        lastSync = nil
        UserDefaults.standard.removeObject(forKey: "beyt.user")
        UserDefaults.standard.removeObject(forKey: "beyt.identities")
        GIDSignIn.sharedInstance.signOut()
        phase = .signedOut
    }

    /// Deletes the account on the server and everything stored there. The data on this phone stays.
    @MainActor
    func deleteAccount() async -> Bool {
        struct OK: Decodable { let ok: Bool }
        do {
            let _: OK = try await request("v1/me", method: "DELETE")
            GIDSignIn.sharedInstance.disconnect { _ in }
            signOut()
            return true
        } catch {
            self.error = "حذف حساب انجام نشد. دوباره امتحان کن."
            return false
        }
    }

    // MARK: sync

    private func scheduleSync() {
        syncTask?.cancel()
        syncTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await self?.sync()
        }
    }

    /// Pull, merge, push. Small payload, so a full round trip each time keeps devices consistent.
    @MainActor
    func sync() async {
        guard phase == .signedIn, let prefs else { return }
        struct Remote: Decodable { let state: Prefs.SyncState?; let updatedAt: String? }
        struct Saved: Decodable { let updatedAt: String }
        do {
            let remote: Remote = try await request("v1/me/state")
            if let r = remote.state {
                applying = true
                prefs.merge(r)
                applying = false
            }
            let local = prefs.syncState
            if local != remote.state {
                let _: Saved = try await request("v1/me/state", method: "PUT", body: ["state": local])
            }
            lastSync = .now
        } catch APIError.unauthorized {
            signOut()
        } catch {
            // Offline: try again on the next change or launch.
        }
    }

    // MARK: network

    enum APIError: Error { case unauthorized, server, noAPI }

    private func request<T: Decodable, B: Encodable>(_ path: String, method: String = "GET", body: B?, auth: Bool = true) async throws -> T {
        guard let base = Account.api else { throw APIError.noAPI }
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = method
        req.timeoutInterval = 20
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        if auth, let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(code) else { throw APIError.server }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func request<T: Decodable>(_ path: String, method: String = "GET", auth: Bool = true) async throws -> T {
        let none: [String: String]? = nil
        return try await request(path, method: method, body: none, auth: auth)
    }
}

/// Tiny Keychain wrapper for the session token.
enum Keychain {
    private static let service = "com.yebeyt"

    static func get(_ key: String) -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: key, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    static func set(_ value: String?, for key: String) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
        SecItemDelete(base as CFDictionary)
        guard let value, let d = value.data(using: .utf8) else { return }
        var add = base
        add[kSecValueData as String] = d
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}

/// Sign in with Apple as an async call (for connecting Apple without the system button).
@MainActor
final class AppleAuth: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>?
    private static var current: AppleAuth?

    static func request() async throws -> ASAuthorizationAppleIDCredential {
        let helper = AppleAuth()
        current = helper
        defer { current = nil }
        return try await withCheckedThrowingContinuation { c in
            helper.continuation = c
            let req = ASAuthorizationAppleIDProvider().createRequest()
            req.requestedScopes = [.fullName, .email]
            let ctrl = ASAuthorizationController(authorizationRequests: [req])
            ctrl.delegate = helper
            ctrl.presentationContextProvider = helper
            ctrl.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        if let cred = authorization.credential as? ASAuthorizationAppleIDCredential { continuation?.resume(returning: cred) }
        else { continuation?.resume(throwing: ASAuthorizationError(.failed)) }
        continuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
