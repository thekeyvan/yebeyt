import Foundation
@testable import Yebeyt

/// A signed-in session against a stub server: the refresh gives the access token "a1".
@MainActor
struct SignedInStub {
    let stub: StubServer
    let session: Session
    let keychain: KeychainStore
    let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!

    /// `routes` answers every call but the refresh.
    init(signedIn: Bool = true, _ routes: @escaping @Sendable (StubServer.Request) -> StubServer.Response = { _ in .json(200, "{}") }) {
        keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        if signedIn { keychain.write("r0") }
        stub = StubServer { request in
            request.path == "/v1/auth/refresh" ? .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar")) : routes(request)
        }
        session = Session(api: stub.api, store: keychain)
    }

    /// Changes what the server answers (the refresh still works).
    func respond(_ routes: @escaping @Sendable (StubServer.Request) -> StubServer.Response) {
        stub.respond { request in
            request.path == "/v1/auth/refresh" ? .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar")) : routes(request)
        }
    }

    func cleanUp() { keychain.delete() }
}
