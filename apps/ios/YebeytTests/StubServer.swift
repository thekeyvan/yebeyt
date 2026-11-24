import Foundation
@testable import Yebeyt

/// A fake server for tests: a URLSession whose requests are answered by a closure. Each stub has its own host,
/// so tests that run at the same time never meet each other's requests.
final class StubServer: @unchecked Sendable {
    struct Request: Sendable {
        var method: String
        var path: String
        var query: String
        var authorization: String?
        var headers: [String: String] = [:]
        var body: Data
        var json: [String: Any] { (try? JSONSerialization.jsonObject(with: body) as? [String: Any]) ?? [:] }
    }

    enum Response: Sendable {
        case json(Int, String)
        /// A JSON answer with extra headers (`Retry-After`).
        case jsonWithHeaders(Int, String, [String: String])
        case data(Data)
        case offline
    }

    private static let registry = Registry()

    private final class Registry: @unchecked Sendable {
        private let lock = NSLock()
        private var servers: [String: StubServer] = [:]
        func add(_ server: StubServer) { lock.withLock { servers[server.host] = server } }
        func server(for host: String?) -> StubServer? { lock.withLock { host.flatMap { servers[$0] } } }
    }

    let host = "stub-\(UUID().uuidString.lowercased()).test"
    var baseURL: URL { URL(string: "https://\(host)")! }
    private let lock = NSLock()
    private var recorded: [Request] = []
    private var handler: @Sendable (Request) -> Response
    /// Slows every answer down, so concurrent calls overlap.
    var delay: TimeInterval = 0

    init(_ handler: @escaping @Sendable (Request) -> Response = { _ in .json(404, #"{"error":"not_found"}"#) }) {
        self.handler = handler
        Self.registry.add(self)
    }

    func respond(_ handler: @escaping @Sendable (Request) -> Response) {
        lock.withLock { self.handler = handler }
    }

    var requests: [Request] { lock.withLock { recorded } }

    func requests(to path: String) -> [Request] { requests.filter { $0.path == path } }

    var session: URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubProtocol.self]
        return URLSession(configuration: configuration)
    }

    var api: API { API(baseURL: baseURL, session: session) }

    fileprivate func answer(_ request: Request) -> Response {
        lock.withLock { recorded.append(request) }
        return lock.withLock { handler }(request)
    }

    private final class StubProtocol: URLProtocol, @unchecked Sendable {
        override class func canInit(with request: URLRequest) -> Bool { StubServer.registry.server(for: request.url?.host) != nil }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
        override func stopLoading() {}

        override func startLoading() {
            guard let url = request.url, let server = StubServer.registry.server(for: url.host) else { return }
            let recorded = Request(
                method: request.httpMethod ?? "GET", path: url.path, query: url.query ?? "",
                authorization: request.value(forHTTPHeaderField: "Authorization"),
                headers: (request.allHTTPHeaderFields ?? [:]).reduce(into: [:]) { $0[$1.key.lowercased()] = $1.value },
                body: Self.body(of: request)
            )
            let client = self.client
            DispatchQueue.global().asyncAfter(deadline: .now() + server.delay) { [self] in
                switch server.answer(recorded) {
                case .json(let status, let text): finish(client, url: url, status: status, data: Data(text.utf8))
                case .jsonWithHeaders(let status, let text, let headers): finish(client, url: url, status: status, data: Data(text.utf8), headers: headers)
                case .data(let data): finish(client, url: url, status: 200, data: data)
                case .offline: client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
                }
            }
        }

        private func finish(_ client: URLProtocolClient?, url: URL, status: Int, data: Data, headers: [String: String] = [:]) {
            let fields = headers.merging(["Content-Type": "application/json"]) { first, _ in first }
            let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: fields)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        }

        private static func body(of request: URLRequest) -> Data {
            if let body = request.httpBody { return body }
            guard let stream = request.httpBodyStream else { return Data() }
            stream.open()
            defer { stream.close() }
            var data = Data()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(buffer, count: count)
            }
            return data
        }
    }
}

enum StubJSON {
    static func user(username: String? = nil, displayName: String? = nil) -> String {
        let name = username.map { "\"\($0)\"" } ?? "null"
        let display = displayName.map { "\"\($0)\"" } ?? "null"
        return #"{"id":"00000000-0000-0000-0000-000000000009","username":\#(name),"displayName":\#(display),"usernameChangedAt":null,"createdAt":"2026-11-23T08:00:00.000Z","providers":["google"]}"#
    }

    static func session(access: String, refresh: String, username: String? = nil) -> String {
        #"{"accessToken":"\#(access)","refreshToken":"\#(refresh)","user":\#(user(username: username))}"#
    }

    static let unauthorized = Response.json(401, #"{"error":"unauthorized"}"#)
    typealias Response = StubServer.Response
}
