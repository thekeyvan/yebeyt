#if DEBUG
import Foundation

/// Debug launch arguments of the games-with-friends slice: `-beytRoute lobby|mosh|duel|challenge-send|challenge:<code>` opens
/// «بازی با دوست», PlayMosh (a game with Sara where it is my turn), PlayDuel (round four of five, played out by fake live events),
/// the end of a جورچین round with the challenge card (8 of 10), or the board of a challenge (`challenge:7KQ2` is نیلوفر's,
/// 8 of 10 on ten couplets by Saadi). With `-beytSignedIn 1` the phone answers for the server (`PlayStub`); `-beytPlayStub 1`
/// does that without a fake sign-in, for a guest opening a challenge (with `-beytPlay <n>` the round is played out at once).
struct PlayLaunchOptions {
    enum Route: Equatable {
        case lobby, mosh, duel, challengeSend
        case challenge(String)

        init?(_ text: String) {
            let parts = text.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false).map(String.init)
            switch (parts[0], parts.count > 1 ? parts[1] : nil) {
            case ("lobby", nil): self = .lobby
            case ("mosh", nil): self = .mosh
            case ("duel", nil): self = .duel
            case ("challenge-send", nil): self = .challengeSend
            case ("challenge", let code?) where !code.isEmpty: self = .challenge(code)
            default: return nil
            }
        }
    }

    let route: Route?
    /// `-beytPlay <n>` with a challenge: its round is played out before it is shown.
    let playsOut: Bool

    init(_ values: [String: Any]) {
        route = (values["beytRoute"] as? String).flatMap(Route.init)
        playsOut = ((values["beytPlay"] as? Int) ?? (values["beytPlay"] as? String).flatMap { Int($0) }) != nil
    }

    static var fromProcess: PlayLaunchOptions {
        PlayLaunchOptions(UserDefaults.standard.dictionaryRepresentation())
    }

    /// Opens what the route names over the tabs.
    @MainActor func prepare(app: AppModel) {
        switch route {
        case .lobby:
            app.select(.games)
            app.game = .lobby(LobbyStart())
        case .mosh:
            app.select(.games)
            app.game = .mosh(PlayStub.moshID)
        case .duel:
            app.select(.games)
            app.game = .duel(PlayStub.duelID)
        case .challengeSend:
            app.autoplay = .end
            app.game = .jigsaw(.deck)
        case .challenge(let code):
            if playsOut { app.autoplay = .end }
            app.game = .challenge(code)
        case nil:
            break
        }
    }
}
#endif
