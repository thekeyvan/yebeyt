import Foundation
import Observation

/// Makes the challenge of a finished round on the server, once, and sends it to the friends: the picked ones as soon as
/// it is made, others on request (`send`). The link is shown on the card (ChallengeSend).
@MainActor @Observable
final class ChallengeSender {
    enum Phase: Equatable {
        case idle, creating
        case created(ChallengeCreated)
        case failed(String)
    }

    let offer: ChallengeOffer
    private(set) var phase = Phase.idle
    /// The usernames that got the challenge as a chat message.
    private(set) var sent: [String] = []
    private let session: Session
    /// My name, for the lines «نیلوفر تو رو به … چالش کشید».
    private let name: String
    /// Sends a chat text to a username; returns the line to show when it failed.
    private let sendText: @MainActor (_ text: String, _ username: String) async -> String?

    init(offer: ChallengeOffer, session: Session, name: String, sendText: @escaping @MainActor (String, String) async -> String?) {
        self.offer = offer
        self.session = session
        self.name = name
        self.sendText = sendText
    }

    var created: ChallengeCreated? {
        if case .created(let made) = phase { made } else { nil }
    }

    /// «yebeyt.com/c/7KQ2», or «yebeyt.com/c/····» while there is no code.
    var linkText: String { PlayCopy.challengeLink(created?.code ?? "····") }

    /// «نیلوفر توی جورچین بیت ۸ از ۱۰ گرفت. تو چند می‌گیری؟»
    var brag: String { PlayCopy.challengeBrag(name: name, game: offer.game.name, score: offer.score) }

    /// What the messengers send.
    var share: SharePayload? {
        created.map { SharePayload(text: "\(brag)\n\($0.url)", url: $0.url) }
    }

    /// Makes the challenge, once: a second call while it is being made or after it was, does nothing; after a failure it tries again.
    func create() async {
        switch phase {
        case .creating, .created: return
        case .idle, .failed: break
        }
        phase = .creating
        do {
            let made = try await session.authorized {
                try await self.session.api.createChallenge(game: self.offer.game, items: self.offer.items, score: self.offer.score, seconds: self.offer.seconds, token: $0)
            }
            phase = .created(made)
            for username in offer.invite { _ = await send(to: username) }
        } catch let error as APIError {
            phase = .failed(error.persianMessage)
        } catch {
            phase = .failed(APIError.network.persianMessage)
        }
    }

    /// Sends the challenge to a friend as a chat message with the link. Returns the line to show when it failed.
    func send(to username: String) async -> String? {
        guard let made = created else { return PlayCopy.challengePending }
        guard !sent.contains(username) else { return nil }
        let line = await sendText(PlayCopy.challengeInvite(name: name, game: offer.game.name, code: made.code), username)
        if line == nil { sent.append(username) }
        return line
    }
}

/// A challenge opened by its code: loaded without an account, played with exactly its ten couplets, and answered with a result.
@MainActor @Observable
final class ChallengeAccept {
    enum Phase: Equatable {
        case loading
        case ready(Challenge)
        case failed(String)
    }

    let code: String
    private(set) var phase = Phase.loading
    private let session: Session

    init(code: String, session: Session) {
        self.code = code
        self.session = session
    }

    var challenge: Challenge? {
        if case .ready(let loaded) = phase { loaded } else { nil }
    }

    /// Without a username there is no account for a result: a name is asked at the end.
    var asksName: Bool { !(session.isSignedIn && session.user?.username != nil) }

    func load() async {
        phase = .loading
        do {
            phase = .ready(try await session.api.challenge(code: code))
        } catch let error as APIError {
            phase = .failed(error.code == .notFound ? PlayCopy.challengeGone : error.persianMessage)
        } catch {
            phase = .failed(APIError.network.persianMessage)
        }
    }

    /// The name a guest gives: trimmed, up to 30 characters (the server's limit); nil when nothing is left.
    static func cleaned(_ name: String) -> String? {
        let trimmed = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(30))
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Leaves my result: with my account, or as a guest with a name. Returns the line to show when it failed.
    func post(score: Int, seconds: Int, name: String?) async -> String? {
        do {
            if asksName {
                guard let name = Self.cleaned(name ?? "") else { return PlayCopy.nameNeeded }
                try await session.api.postChallengeResult(code: code, score: score, seconds: seconds, name: name, token: nil)
            } else {
                try await session.authorized { try await self.session.api.postChallengeResult(code: self.code, score: score, seconds: seconds, name: nil, token: $0) }
            }
            return nil
        } catch let error as APIError {
            return error.code == .conflict ? PlayCopy.alreadyAnswered : error.persianMessage
        } catch {
            return APIError.network.persianMessage
        }
    }

    /// Who won: more than the maker's score wins, equal is a draw.
    static func outcome(mine: Int, theirs: Int) -> MoshState.Outcome {
        mine > theirs ? .won : mine == theirs ? .draw : .lost
    }
}
