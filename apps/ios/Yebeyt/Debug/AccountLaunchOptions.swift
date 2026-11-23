#if DEBUG
import Foundation

/// Debug launch arguments of the accounts slice, for simulator screenshots and UI tests:
/// `-beytOnboarding welcome|taste|game|account|username|friends` starts onboarding at that screen (`account` as after
/// a won game, with «آفرین! +۵۰»; without the argument a
/// debug launch skips onboarding; a release build shows it on the first launch), `-beytGate likes|messages` opens
/// the account gate over the first screen, `-beytSignedIn 1` is a fake sign-in whose server is answered on the
/// phone (no network), `-beytAPI <url>` points the app at another server, and `-beytFresh 1` also signs out and
/// forgets the taste and the onboarding flag.
struct AccountLaunchOptions {
    let onboarding: OnboardingStep?
    let gate: AccountFeature?
    let signedIn: Bool
    let api: String?
    let fresh: Bool

    init(_ values: [String: Any]) {
        onboarding = (values["beytOnboarding"] as? String).flatMap(OnboardingStep.init(rawValue:))
        gate = (values["beytGate"] as? String).flatMap(AccountFeature.init(rawValue:))
        signedIn = Self.flag(values["beytSignedIn"])
        api = values["beytAPI"] as? String
        fresh = Self.flag(values["beytFresh"])
    }

    private static func flag(_ value: Any?) -> Bool {
        (value as? Int) == 1 || (value as? String) == "1"
    }

    static var fromProcess: AccountLaunchOptions {
        AccountLaunchOptions(UserDefaults.standard.dictionaryRepresentation())
    }

    /// The signed-in user of `-beytSignedIn 1`.
    static let debugUser = APIUser(
        id: "00000000-0000-0000-0000-000000000001", username: "niloofar", displayName: nil,
        usernameChangedAt: nil, createdAt: "2026-11-23T08:00:00.000Z", providers: [.apple]
    )

    /// The client: the real server, `-beytAPI`, or with `-beytSignedIn` a stand-in on the phone.
    func makeAPI() -> API {
        if signedIn {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [DebugBackend.self]
            return API.configured(override: api, session: URLSession(configuration: configuration))
        }
        return API.configured(override: api)
    }
}

/// The server as `-beytSignedIn` sees it: every name is free, three names are suggested, saves succeed, the divan
/// is empty, the privacy settings are the defaults, deleting the account works, and no poet has a picture.
final class DebugBackend: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        let path = request.url?.path ?? ""
        let (status, body): (Int, String) = switch (request.httpMethod ?? "GET", path) {
        case (_, "/v1/usernames/check"): (200, #"{"available":true}"#)
        case (_, "/v1/usernames/suggestions"): (200, #"{"suggestions":["niloofar.sh","niloo_ghazal","niloofar1403"]}"#)
        case ("PUT", "/v1/me/username"), ("PUT", "/v1/me/profile"): (200, Self.userJSON)
        case ("PUT", "/v1/me/progress"): (200, #"{"points":0,"streakDays":0,"streakLastDate":null,"bestByGame":{}}"#)
        case (_, "/v1/me/divan"): (200, #"{"items":[]}"#)
        case (_, "/v1/me/privacy"): (200, Self.privacyJSON)
        case ("PUT", "/v1/me/avatar"): (200, Self.userJSON)
        case ("DELETE", "/v1/me"): (204, "")
        case (_, "/v1/poets/pictures"): (200, "[]")
        default: (404, #"{"error":"not_found"}"#)
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    private static let privacyJSON = #"{"keptVisibility":"friends","dailyVisibility":"friends","showOnline":true,"inGlobalLeaderboard":false,"messagesFrom":"friends","gameInvitesFrom":"all","allowReposts":true}"#

    private static let userJSON = #"{"id":"00000000-0000-0000-0000-000000000001","username":"niloofar","displayName":null,"usernameChangedAt":null,"createdAt":"2026-11-23T08:00:00.000Z","providers":["apple"]}"#
}
#endif
