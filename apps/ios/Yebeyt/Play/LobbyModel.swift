import Foundation
import Observation

/// The four games of the lobby, in the board's order. جورچین and حدس شاعر are challenges: the player plays the ten
/// couplets first and the challenge goes to the friends afterwards.
enum LobbyGame: CaseIterable, Sendable {
    case mosh, duel, jigsaw, poet

    var kind: GameKind {
        switch self {
        case .mosh: .mosh
        case .duel: .duel
        case .jigsaw: .jigsaw
        case .poet: .poet
        }
    }

    /// The name on the tile: «جورچین» is the short name of «جورچین بیت».
    var title: String {
        switch self {
        case .mosh: "مشاعره"
        case .duel: "رودررو"
        case .jigsaw: "جورچین"
        case .poet: "حدس شاعر"
        }
    }

    var challenge: ChallengeGame? {
        switch self {
        case .jigsaw: .jigsaw
        case .poet: .poet
        case .mosh, .duel: nil
        }
    }

    /// The time for each turn is only a choice in مشاعره.
    var hasTurnTime: Bool { self == .mosh }
}

/// What opens the lobby: the game chosen first and, from a chat, the friend to invite.
struct LobbyStart: Equatable, Sendable {
    var game = LobbyGame.mosh
    var friend: PersonShort?
}

/// The lobby (GameLobby): the game, the turn time, who to invite. What it makes is a `Plan`.
@MainActor @Observable
final class LobbyModel {
    /// What «بساز و دعوت کن» does.
    enum Plan: Equatable {
        /// A game that waits for the friend: made on the server with the invitations.
        case friendGame(kind: FriendGame.Kind, turnSeconds: Int?, invite: [String])
        /// A challenge: the player plays the round first, then it goes to these friends.
        case challenge(ChallengeGame, invite: [String])
    }

    static let turnChoices = [30, 120, 86_400]
    /// The server takes up to five invitations.
    static let maxInvites = 5
    /// The friends in the row before «بیشتر».
    static let shownFriends = 3

    var game: LobbyGame {
        didSet { if game != oldValue { discardMade() } }
    }
    var turnSeconds = 86_400 {
        didSet { if turnSeconds != oldValue { discardMade() } }
    }
    private(set) var selected: [String]
    /// The game made for the link or the button; the second tap uses it instead of making another.
    private(set) var made: FriendGame?
    /// Who the server sent an invitation to when the game was made, and who got the link as a chat message since.
    private var invited: Set<String> = []
    /// The game being made: a second tap (the link, then the button) waits for it instead of making another.
    @ObservationIgnored private var creating: Task<GameCreated, any Error>?
    /// Which settings a game was made for: a game made for earlier settings is dropped when it comes back.
    @ObservationIgnored private var generation = 0
    /// Who could not be invited when it was made: «سارا» takes invitations only from friends.
    private(set) var skipped: [GameCreated.Skipped] = []
    /// The line a chat invitation failed with, by username; gone when it goes on a later try.
    private var lateFailures: [String: String] = [:]
    private var friends: [PersonShort] = []
    private var extras: [PersonShort] = []
    private let start: PersonShort?
    private let session: Session

    init(start: LobbyStart, session: Session) {
        game = start.game
        self.start = start.friend
        self.session = session
        selected = start.friend.map { [$0.username] } ?? []
    }

    /// The faces in the row: the friend the lobby was opened for, then my friends (three), then the ones chosen with «بیشتر».
    var people: [PersonShort] {
        var seen = Set<String>()
        return ((start.map { [$0] } ?? []) + friends.prefix(Self.shownFriends) + extras).filter { seen.insert($0.username).inserted }
    }

    var plan: Plan {
        if let challenge = game.challenge { return .challenge(challenge, invite: selected) }
        return .friendGame(kind: game == .duel ? .duel : .mosh, turnSeconds: game == .mosh ? turnSeconds : nil, invite: selected)
    }

    func loadFriends() async {
        guard let page = try? await session.authorized({ try await self.session.api.friends(cursor: nil, token: $0) }) else { return }
        friends = page.playable
    }

    /// Chooses or lets go of a person. False when five are chosen already.
    @discardableResult
    func toggle(_ username: String) -> Bool {
        if let index = selected.firstIndex(of: username) {
            selected.remove(at: index)
            return true
        }
        guard selected.count < Self.maxInvites else { return false }
        selected.append(username)
        return true
    }

    /// A person found with «بیشتر».
    @discardableResult
    func add(_ person: FoundPerson) -> Bool {
        if !people.contains(where: { $0.username == person.username }) { extras.append(person.short) }
        return selected.contains(person.username) || toggle(person.username)
    }

    // MARK: Making the game

    /// A game made for other settings is forgotten. The server has no way to end a game that waits (it expires by itself
    /// after a week, its code is free again then), so the old one is left; the next share or «بساز» makes a new one.
    private func discardMade() {
        made = nil
        creating = nil
        invited = []
        skipped = []
        lateFailures = [:]
        generation += 1
    }

    /// The game that waits for the friend, made once: the link and the button share it, also when both are tapped before the
    /// server answers. Friends picked after it was made get the link as a chat message (`sendText(text, username)` returns a
    /// line when it failed). Nil for a challenge (made after the round).
    func makeGame(using games: FriendGames, sendText: @MainActor (String, String) async -> String? = { _, _ in nil }) async throws -> FriendGame? {
        guard case .friendGame(let kind, let seconds, let invite) = plan else { return nil }
        if made == nil {
            let ticket = generation
            let task = creating ?? Task { @MainActor in try await games.create(kind: kind, turnSeconds: seconds, invite: invite) }
            creating = task
            let created: GameCreated
            do {
                created = try await task.value
            } catch {
                if ticket == generation { creating = nil }  // a failed try is tried again next time
                throw error
            }
            guard ticket == generation else { return created.game }  // the settings changed meanwhile: this one is not the lobby's
            if made == nil {
                made = created.game
                invited = Set(created.invited)
                skipped = created.skipped
            }
            creating = nil
        }
        guard let game = made else { return nil }
        await inviteLate(to: game, sendText: sendText)
        return game
    }

    /// Friends picked after the game was made were not in its invitations: they get the link in a chat.
    private func inviteLate(to game: FriendGame, sendText: @MainActor (String, String) async -> String?) async {
        let url = "https://\(PlayCopy.gameLink(game.code))"
        let text = PlayCopy.gameShare(game: self.game.kind.name, url: url)
        for username in selected where !invited.contains(username) && !skipped.contains(where: { $0.username == username }) {
            invited.insert(username)
            if let failure = await sendText(text, username) {
                invited.remove(username)  // tried again next time
                lateFailures[username] = failure
            } else {
                lateFailures[username] = nil
            }
        }
    }

    /// The line for the people who were not invited, or whose chat invitation did not go (nil when everybody was): the game
    /// is made anyway, and its link works.
    var skippedLine: String? {
        let lines = skipped.compactMap { PlayCopy.skipped($0) } + selected.compactMap { name in lateFailures[name].map { "\(name): \($0)" } }
        return lines.isEmpty ? nil : lines.joined(separator: "؛ ")
    }

    /// The link of the game made, or «yebeyt.com/g/…» before one is.
    var linkText: String { made.map { PlayCopy.gameLink($0.code) } ?? "yebeyt.com/g/…" }
}
