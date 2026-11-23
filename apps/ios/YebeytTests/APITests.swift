import Foundation
import Testing
@testable import Yebeyt

struct APITests {
    @Test func theServerAddressComesFromInfoPlistAndDebugCanOverrideIt() {
        #expect(API.configured(override: "http://localhost:8080").baseURL.absoluteString == "http://localhost:8080")
        let app = Bundle.main.object(forInfoDictionaryKey: "YebeytAPIURL") as? String
        #expect(app == "https://api.yebeyt.com")
        #expect(API.configured().baseURL.absoluteString == "https://api.yebeyt.com")
    }

    @Test func serverCodesBecomePersianLines() {
        func line(_ code: APIErrorCode) -> String { APIError.server(status: 409, code: code, allowedAt: nil).persianMessage }
        #expect(line(.usernameTaken) == "قبلاً گرفته شده")
        #expect(line(.usernameTooShort) == "حداقل ۳ حرف")
        #expect(line(.usernameTooLong) == "حداکثر ۲۰ حرف")
        #expect(line(.usernameBadChars) == "فقط حروف انگلیسی، عدد، «_» و «.»")
        #expect(line(.usernameReserved) == "این اسم رزرو شده")
        #expect(line(.usernameChangeTooSoon).contains("۳۰ روز"))
        #expect(APIError.network.persianMessage.contains("اینترنت"))
        for code in [APIErrorCode.internalError, .unavailable, .invalidRequest, .payloadTooLarge] {
            #expect(line(code) == APIError.badResponse.persianMessage)  // nothing technical reaches the screen
        }
        #expect(!APIError.server(status: 500, code: nil, allowedAt: nil).persianMessage.contains("error"))
    }

    @Test func anErrorBodyBecomesAnAPIError() async {
        let stub = StubServer { _ in .json(409, #"{"error":"username_change_too_soon","allowedAt":"2026-12-01T08:00:00.000Z"}"#) }
        await #expect(throws: APIError.server(status: 409, code: .usernameChangeTooSoon, allowedAt: "2026-12-01T08:00:00.000Z")) {
            _ = try await stub.api.setUsername("name", token: "t")
        }
        stub.respond { _ in .json(418, #"{"error":"something_new"}"#) }
        await #expect(throws: APIError.server(status: 418, code: nil, allowedAt: nil)) { _ = try await stub.api.me(token: "t") }
        stub.respond { _ in .json(502, "<html>bad gateway</html>") }
        await #expect(throws: APIError.server(status: 502, code: nil, allowedAt: nil)) { _ = try await stub.api.me(token: "t") }
        stub.respond { _ in .offline }
        await #expect(throws: APIError.network) { _ = try await stub.api.me(token: "t") }
        stub.respond { _ in .json(200, "{}") }
        await #expect(throws: APIError.badResponse) { _ = try await stub.api.me(token: "t") }
    }

    @Test func requestsFollowTheContract() async throws {
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/apple", "/v1/auth/google", "/v1/auth/refresh": .json(200, StubJSON.session(access: "a", refresh: "r"))
            case "/v1/me/profile", "/v1/me/username": .json(200, StubJSON.user())
            case "/v1/usernames/check": .json(200, #"{"available":false,"reason":"taken"}"#)
            case "/v1/usernames/suggestions": .json(200, #"{"suggestions":["a1","a2"]}"#)
            case "/v1/me/progress": .json(200, #"{"points":5,"streakDays":0,"streakLastDate":null,"bestByGame":{}}"#)
            case "/v1/auth/logout": .json(204, "")
            default: .json(404, "{}")
            }
        }
        let api = stub.api
        _ = try await api.signInWithApple(identityToken: "id-token", authorizationCode: "code", nonce: "raw-nonce")
        _ = try await api.signInWithGoogle(idToken: "google-token")
        _ = try await api.refresh(refreshToken: "r0")
        _ = try await api.setDisplayName("علی", token: "tok")
        _ = try await api.setUsername("ali", token: "tok")
        let check = try await api.checkUsername("a b&c", token: "tok")
        let suggestions = try await api.usernameSuggestions(base: "ali", token: "tok")
        try await api.putProgress(ProgressPayload(points: 5, streakDays: 0, streakLastDate: nil, bestByGame: [:]), token: "tok")
        try await api.logout(refreshToken: "r0")

        #expect(check == UsernameCheck(available: false, reason: "taken"))
        #expect(suggestions == ["a1", "a2"])
        let apple = try #require(stub.requests(to: "/v1/auth/apple").first)
        #expect(apple.method == "POST")
        #expect(apple.json["identityToken"] as? String == "id-token")
        #expect(apple.json["authorizationCode"] as? String == "code")
        #expect(apple.json["nonce"] as? String == "raw-nonce")
        #expect(apple.authorization == nil)
        #expect(stub.requests(to: "/v1/auth/google").first?.json["idToken"] as? String == "google-token")
        #expect(stub.requests(to: "/v1/auth/refresh").first?.json["refreshToken"] as? String == "r0")
        let profile = try #require(stub.requests(to: "/v1/me/profile").first)
        #expect(profile.method == "PUT")
        #expect(profile.authorization == "Bearer tok")
        #expect(profile.json["displayName"] as? String == "علی")
        #expect(stub.requests(to: "/v1/me/username").first?.json["username"] as? String == "ali")
        let query = try #require(stub.requests(to: "/v1/usernames/check").first)
        #expect(query.method == "GET")
        let items = URLComponents(string: "https://x.test/?\(query.query)")?.queryItems
        #expect(items?.first?.name == "u")
        #expect(items?.first?.value == "a b&c")  // the name is encoded, not cut at the ampersand
        #expect(stub.requests(to: "/v1/usernames/suggestions").first?.query == "base=ali")
        let progress = try #require(stub.requests(to: "/v1/me/progress").first)
        #expect(progress.json["streakLastDate"] is NSNull)  // the key is sent even when the date is null
        #expect(stub.requests(to: "/v1/auth/logout").first?.json["refreshToken"] as? String == "r0")
    }

    @Test func userAndSessionDecodeTheContractsShape() throws {
        let session = try JSONDecoder().decode(APISession.self, from: Data(StubJSON.session(access: "a", refresh: "r", username: "ali").utf8))
        #expect(session.user.username == "ali")
        #expect(session.user.displayName == nil)
        #expect(session.user.providers == [.google])
        #expect(session.refreshToken == "r")
    }
}
