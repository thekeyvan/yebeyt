import Foundation
import Observation

/// Who is signed in. The refresh token lives in the Keychain, the access token only in memory.
/// Only one refresh runs at a time: calls that find the access token expired wait for it and share its result.
@MainActor @Observable
final class Session {
    /// A refresh token is stored. True at once on launch, before the user is fetched, so a signed-in person is
    /// never shown the account gate.
    private(set) var isSignedIn: Bool
    private(set) var user: APIUser?
    let api: API
    @ObservationIgnored private let store: KeychainStore
    @ObservationIgnored private var accessToken: String?
    @ObservationIgnored private var refreshTask: Task<Void, Error>?

    init(api: API, store: KeychainStore = KeychainStore()) {
        self.api = api
        self.store = store
        isSignedIn = store.read() != nil
    }

    /// Debug only: a signed-in state without a server (`-beytSignedIn 1`).
    init(api: API, store: KeychainStore, fake user: APIUser) {
        self.api = api
        self.store = store
        isSignedIn = true
        self.user = user
        accessToken = "debug-access-token"
    }

    /// Takes a new sign-in: both tokens and the user.
    func apply(_ session: APISession) {
        accessToken = session.accessToken
        store.write(session.refreshToken)
        user = session.user
        isSignedIn = true
    }

    /// The user changed (a name or username was saved).
    func update(user: APIUser) {
        self.user = user
    }

    /// On launch: gets the user (and fresh tokens) for a stored sign-in. A phone with no network stays signed in.
    func restore() async {
        guard isSignedIn, user == nil else { return }
        try? await refresh()
    }

    /// Runs a call with the access token, refreshing it first when there is none and once more when the server
    /// refuses it.
    func authorized<Value>(_ operation: (String) async throws -> Value) async throws -> Value {
        var token = try await currentAccessToken()
        do {
            return try await operation(token)
        } catch let error as APIError where error.isUnauthorized {
            if let current = accessToken, current != token {
                token = current  // another call has refreshed meanwhile
            } else {
                try await refresh()
                token = try await currentAccessToken()
            }
            return try await operation(token)
        }
    }

    /// Swaps the refresh token for a new pair. A refresh already running is waited for instead of started again.
    func refresh() async throws {
        if let refreshTask { return try await refreshTask.value }
        guard let sent = store.read() else {
            clear()
            throw APIError.server(status: 401, code: .unauthorized, allowedAt: nil)
        }
        let task = Task { @MainActor [self] in
            defer { refreshTask = nil }
            do {
                apply(try await api.refresh(refreshToken: sent))
            } catch let error as APIError where error.isUnauthorized {
                // The token is single use. If the Keychain holds another one now, a refresh that raced this one has
                // won: its result stands and this is not a sign-out.
                if let stored = store.read(), stored != sent {
                    accessToken = nil
                    return
                }
                clear()
                throw error
            }
        }
        refreshTask = task
        try await task.value
    }

    /// «خروج»: forgets the sign-in here at once, then tells the server (which may fail; the token expires anyway).
    func signOut() async {
        let token = store.read()
        clear()
        if let token { try? await api.logout(refreshToken: token) }
    }

    private func currentAccessToken() async throws -> String {
        if accessToken == nil { try await refresh() }
        guard let accessToken else { throw APIError.server(status: 401, code: .unauthorized, allowedAt: nil) }
        return accessToken
    }

    private func clear() {
        store.delete()
        accessToken = nil
        user = nil
        isSignedIn = false
    }
}
