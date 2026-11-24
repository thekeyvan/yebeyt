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
        didSet { if game != oldValue { made = nil } }
    }
    var turnSeconds = 86_400 {
        didSet { if turnSeconds != oldValue { made = nil } }
    }
    private(set) var selected: [String]
    /// The game made for the link or the button; the second tap uses it instead of making another.
    private(set) var made: FriendGame?
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
        friends = page.items.map(\.short)
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

    /// The game that waits for the friend, made once: the link and the button share it. Nil for a challenge (made after the round).
    func makeGame(using games: FriendGames) async throws -> FriendGame? {
        guard case .friendGame(let kind, let seconds, let invite) = plan else { return nil }
        if let made { return made }
        let created = try await games.create(kind: kind, turnSeconds: seconds, invite: invite)
        made = created.game
        return created.game
    }

    /// The link of the game made, or «yebeyt.com/g/…» before one is.
    var linkText: String { made.map { PlayCopy.gameLink($0.code) } ?? "yebeyt.com/g/…" }
}
