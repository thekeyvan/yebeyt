import Foundation

/// The client of api.yebeyt.com. JSON in and out, the field names as in `packages/api/openapi.json`.
/// Errors are turned into `APIError` here; the screens show `APIError.persianMessage`.
struct API: Sendable {
    static let productionURL = URL(string: "https://api.yebeyt.com")!

    let baseURL: URL
    let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    /// The address from Info.plist (`YebeytAPIURL`). A debug launch can override it with `-beytAPI <url>`.
    static func configured(bundle: Bundle = .main, override: String? = nil, session: URLSession = .shared) -> API {
        let text = override ?? bundle.object(forInfoDictionaryKey: "YebeytAPIURL") as? String
        return API(baseURL: text.flatMap { URL(string: $0) } ?? productionURL, session: session)
    }

    // MARK: Endpoints

    func signInWithApple(identityToken: String, authorizationCode: String?, nonce: String) async throws -> APISession {
        struct Body: Encodable { var identityToken: String; var authorizationCode: String?; var nonce: String }
        return try await call("POST", "/v1/auth/apple", body: Body(identityToken: identityToken, authorizationCode: authorizationCode, nonce: nonce))
    }

    func signInWithGoogle(idToken: String) async throws -> APISession {
        try await call("POST", "/v1/auth/google", body: ["idToken": idToken])
    }

    func refresh(refreshToken: String) async throws -> APISession {
        try await call("POST", "/v1/auth/refresh", body: ["refreshToken": refreshToken])
    }

    func logout(refreshToken: String) async throws {
        try await callWithoutAnswer("POST", "/v1/auth/logout", body: ["refreshToken": refreshToken])
    }

    func me(token: String) async throws -> APIUser {
        try await call("GET", "/v1/me", token: token)
    }

    func setDisplayName(_ name: String, token: String) async throws -> APIUser {
        try await call("PUT", "/v1/me/profile", body: ["displayName": name], token: token)
    }

    func setUsername(_ username: String, token: String) async throws -> APIUser {
        try await call("PUT", "/v1/me/username", body: ["username": username], token: token)
    }

    func checkUsername(_ username: String, token: String) async throws -> UsernameCheck {
        try await call("GET", "/v1/usernames/check", query: [URLQueryItem(name: "u", value: username)], token: token)
    }

    func usernameSuggestions(base: String, token: String) async throws -> [String] {
        struct Answer: Decodable { var suggestions: [String] }
        let answer: Answer = try await call("GET", "/v1/usernames/suggestions", query: [URLQueryItem(name: "base", value: base)], token: token)
        return answer.suggestions
    }

    func putProgress(_ progress: ProgressPayload, token: String) async throws {
        let _: ProgressPayload = try await call("PUT", "/v1/me/progress", body: progress, token: token)
    }

    func divan(token: String) async throws -> [DivanItem] {
        let state: DivanState = try await call("GET", "/v1/me/divan", token: token)
        return state.items
    }

    /// Merges `items` (at most 2000) into the stored divan; answers the whole merged divan.
    func putDivan(_ items: [DivanItem], token: String) async throws -> [DivanItem] {
        let state: DivanState = try await call("PUT", "/v1/me/divan", body: DivanState(items: items), token: token)
        return state.items
    }

    func privacy(token: String) async throws -> PrivacySettings {
        try await call("GET", "/v1/me/privacy", token: token)
    }

    func putPrivacy(_ patch: PrivacyPatch, token: String) async throws -> PrivacySettings {
        try await call("PUT", "/v1/me/privacy", body: patch, token: token)
    }

    func setAvatar(_ parts: AvatarParts, token: String) async throws -> APIUser {
        try await call("PUT", "/v1/me/avatar", body: parts, token: token)
    }

    /// «خبرهای یه بیت رو برام ایمیل کن»: the person's own choice; answers the user with it.
    func setNews(_ optIn: Bool, token: String) async throws -> APIUser {
        struct Body: Encodable { var optIn: Bool }
        return try await call("PUT", "/v1/me/news", body: Body(optIn: optIn), token: token)
    }

    /// Deletes the account and everything stored for it. 502 `apple_revoke_failed` leaves it as it was.
    func deleteAccount(token: String) async throws {
        _ = try await data(for: request("DELETE", "/v1/me", query: [], body: nil, token: token))
    }

    func poetPictures() async throws -> [PoetPictureEntry] {
        try await call("GET", "/v1/poets/pictures")
    }

    /// The bytes of a picture, from the `url` of its list entry.
    func pictureData(path: String) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else { throw APIError.badResponse }
        return try await data(for: URLRequest(url: url))
    }

    /// A report. Signed in (a `token`) it carries the user; as a guest it carries nobody.
    func postFeedback(_ payload: FeedbackPayload, token: String?) async throws -> FeedbackCreated {
        try await call("POST", "/v1/feedback", body: payload, token: token)
    }

    /// Attaches a file to a report with the `uploadToken` that came with it. 503 `busy` is `APIError.busy`.
    func uploadAttachment(_ kind: FeedbackAttachment, reportID: String, uploadToken: String, data: Data) async throws {
        var request = try request("PUT", "/v1/feedback/\(reportID)/\(kind.path)", query: [], body: nil, token: nil)
        request.setValue(kind.contentType, forHTTPHeaderField: "Content-Type")
        request.setValue(uploadToken, forHTTPHeaderField: "X-Upload-Token")
        request.timeoutInterval = 90
        _ = try await self.data(for: request, upload: data)
    }

    // MARK: Plumbing

    func call<Answer: Decodable>(_ method: String, _ path: String, query: [URLQueryItem] = [], token: String? = nil) async throws -> Answer {
        try decode(await data(for: request(method, path, query: query, body: nil, token: token)))
    }

    func call<Answer: Decodable>(_ method: String, _ path: String, body: some Encodable, token: String? = nil) async throws -> Answer {
        try decode(await data(for: request(method, path, query: [], body: JSONEncoder().encode(body), token: token)))
    }

    private func callWithoutAnswer(_ method: String, _ path: String, body: some Encodable) async throws {
        _ = try await data(for: request(method, path, query: [], body: JSONEncoder().encode(body), token: nil))
    }

    /// A call whose answer is empty (204) or not needed.
    func send(_ method: String, _ path: String, query: [URLQueryItem] = [], token: String) async throws {
        _ = try await data(for: request(method, path, query: query, body: nil, token: token))
    }

    func send(_ method: String, _ path: String, body: some Encodable, token: String) async throws {
        _ = try await data(for: request(method, path, query: [], body: JSONEncoder().encode(body), token: token))
    }

    private func decode<Answer: Decodable>(_ data: Data) throws -> Answer {
        do {
            return try JSONDecoder().decode(Answer.self, from: data)
        } catch {
            throw APIError.badResponse
        }
    }

    private func request(_ method: String, _ path: String, query: [URLQueryItem], body: Data?, token: String?) throws -> URLRequest {
        guard var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false) else { throw APIError.badResponse }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.badResponse }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        return request
    }

    private func data(for request: URLRequest, upload: Data? = nil) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            if let upload {
                (data, response) = try await session.upload(for: request, from: upload)
            } else {
                (data, response) = try await session.data(for: request)
            }
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw APIError.network
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            struct Body: Decodable { var error: String?; var allowedAt: String? }
            let body = try? JSONDecoder().decode(Body.self, from: data)
            if http.statusCode == 503, body?.error == APIErrorCode.busy.rawValue {
                throw APIError.busy(retryAfter: http.value(forHTTPHeaderField: "Retry-After").flatMap { Int($0) } ?? 2)
            }
            throw APIError.server(status: http.statusCode, code: body?.error.flatMap(APIErrorCode.init(rawValue:)), allowedAt: body?.allowedAt)
        }
        return data
    }
}
