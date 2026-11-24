import Foundation

/// The error codes of the server (`{ "error": "<code>" }`, see packages/api/openapi.json).
enum APIErrorCode: String, Sendable {
    case invalidRequest = "invalid_request"
    case invalidToken = "invalid_token"
    case unauthorized
    case forbidden
    case notFound = "not_found"
    case rateLimited = "rate_limited"
    case usernameTaken = "username_taken"
    case usernameReserved = "username_reserved"
    case usernameTooShort = "username_too_short"
    case usernameTooLong = "username_too_long"
    case usernameBadChars = "username_bad_chars"
    case usernameChangeTooSoon = "username_change_too_soon"
    case appleRevokeFailed = "apple_revoke_failed"
    case payloadTooLarge = "payload_too_large"
    case unsupportedMediaType = "unsupported_media_type"
    case internalError = "internal_error"
    case unavailable
    case conflict
    case pointsTooHigh = "points_too_high"
    case badTimestamp = "bad_timestamp"
    case usernameRequired = "username_required"
}

/// What went wrong with a call to the server.
enum APIError: Error, Equatable, Sendable {
    /// The server answered with an error. `code` is nil for a code this app doesn't know.
    case server(status: Int, code: APIErrorCode?, allowedAt: String?)
    /// The phone could not reach the server.
    case network
    /// The answer was not what the contract says.
    case badResponse

    var code: APIErrorCode? {
        if case .server(_, let code, _) = self { code } else { nil }
    }

    /// The server refused the access or refresh token.
    var isUnauthorized: Bool {
        if case .server(let status, _, _) = self { status == 401 } else { false }
    }

    /// The server will never take this request as it is (a client error other than 401, 408 and 429): sending it
    /// again is useless, so a queue drops it. A 409 is the round already counted.
    var isFinal: Bool {
        if case .server(let status, _, _) = self { (400..<500).contains(status) && ![401, 408, 429].contains(status) } else { false }
    }

    /// The Persian line shown to the person. The codes themselves never reach the screen.
    var persianMessage: String {
        switch self {
        case .network: "اینترنت نیست؛ یه بار دیگه امتحان کن."
        case .badResponse: "یه مشکلی پیش اومد؛ یه بار دیگه امتحان کن."
        case .server(_, let code, _):
            switch code {
            case .usernameTaken: "قبلاً گرفته شده"
            case .usernameTooShort: "حداقل ۳ حرف"
            case .usernameTooLong: "حداکثر ۲۰ حرف"
            case .usernameBadChars: "فقط حروف انگلیسی، عدد، «_» و «.»"
            case .usernameReserved: "این اسم رزرو شده"
            case .usernameChangeTooSoon: "هر ۳۰ روز یه بار می‌شه نام کاربری رو عوض کرد."
            case .rateLimited: "یکم صبر کن و دوباره امتحان کن."
            case .appleRevokeFailed: "الان نشد، یه کم دیگه دوباره امتحان کن"
            case .invalidToken, .unauthorized: "ورود انجام نشد؛ دوباره امتحان کن."
            default: "یه مشکلی پیش اومد؛ یه بار دیگه امتحان کن."
            }
        }
    }
}
