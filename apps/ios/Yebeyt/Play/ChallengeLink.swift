import SwiftUI

/// The link of a challenge in a message: «yebeyt.com/c/7KQ2». Tapping it in a chat opens the challenge in the app (links
/// from outside the app open it with Universal Links, which come with the website).
enum ChallengeLink {
    private static var pattern: Regex<(Substring, Substring)> { #/(?:https?://)?(?:www\.)?yebeyt\.com/c/([0-9A-Za-z]{4})(?![0-9A-Za-z])/# }

    /// The code of the first challenge link in a text, nil when there is none.
    static func code(in text: String) -> String? {
        text.firstMatch(of: pattern).map { String($0.output.1) }
    }

    /// The code of a link tapped: «https://yebeyt.com/c/7KQ2».
    static func code(of url: URL) -> String? {
        code(in: url.absoluteString)
    }

    /// The text with every challenge link made a link (underlined, in `color`).
    static func linked(_ text: String, color: Color) -> AttributedString {
        var result = AttributedString(text)
        for match in text.matches(of: pattern) {
            guard let range = Range(match.range, in: result), let url = URL(string: "https://yebeyt.com/c/\(match.output.1)") else { continue }
            result[range].link = url
            result[range].foregroundColor = color
            result[range].underlineStyle = .single
        }
        return result
    }
}
