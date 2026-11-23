import Foundation
import os
import Testing
@testable import Yebeyt

enum Fixtures {
    private final class Token {}

    /// The app bundle, which holds the bundled poetry data.
    static let appBundle = Bundle(for: PoetryStore.self)

    static func data(_ name: String, extension fileExtension: String = "json") throws -> Data {
        let url = try #require(Bundle(for: Token.self).url(forResource: name, withExtension: fileExtension))
        return try Data(contentsOf: url)
    }
}

/// Answers every request from a table, and records what was asked. Suites that use it run serialized.
final class StubURLProtocol: URLProtocol {
    struct State: Sendable {
        var responses: [String: (status: Int, body: Data)] = [:]
        var requests: [URL] = []
    }

    static let state = OSAllocatedUnfairLock(initialState: State())

    static func reset(_ responses: [String: (status: Int, body: Data)] = [:]) {
        state.withLock { $0 = State(responses: responses) }
    }

    static var requests: [URL] { state.withLock { $0.requests } }

    static func session() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let answer = Self.state.withLock { state -> (status: Int, body: Data)? in
            state.requests.append(url)
            return state.responses[url.absoluteString]
        }
        guard let answer else {
            client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
            return
        }
        let response = HTTPURLResponse(url: url, statusCode: answer.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: answer.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
