import Foundation
import Observation

/// The games with friends of this phone: the games I know (by id), the live state of a رودررو, and the calls that
/// play them. Live events and the lists meet here, as in `MessagesCenter`; the screens only read it.
@MainActor @Observable
final class FriendGames {
    let session: Session
    private(set) var games: [String: FriendGame] = [:]
    /// The ids of my games from the last read of `/v1/me/games`, newest first.
    private(set) var mineIDs: [String] = []
    private(set) var duels: [String: DuelState] = [:]
    /// Sends a text over the live socket; false when it is not open.
    @ObservationIgnored var sendLive: (@MainActor (String) async -> Bool)?
    /// A line to show for a moment over the tabs (a guest answered my challenge).
    @ObservationIgnored var toast: (@MainActor (String) -> Void)?
    @ObservationIgnored private let now: @MainActor () -> Date

    init(session: Session, now: @escaping @MainActor () -> Date = { .now }) {
        self.session = session
        self.now = now
    }

    var me: String? { session.user?.username }

    func game(_ id: String) -> FriendGame? { games[id] }

    // MARK: Which game is most urgent

    /// The مشاعره game where it is my turn and the time runs out first; nil when no turn is mine.
    var urgentMosh: FriendGame? {
        guard let me else { return nil }
        return mineIDs.compactMap { games[$0] }
            .filter { $0.kind == .mosh && $0.status == .active && $0.turn?.username == me }
            .min { ($0.turn?.deadline ?? .distantFuture) < ($1.turn?.deadline ?? .distantFuture) }
    }

    // MARK: Reading

    func refreshMine() async {
        guard let list = try? await session.authorized({ try await self.session.api.myGames(token: $0) }) else { return }
        mineIDs = list.map(\.id)
        for game in list { store(game) }
    }

    /// One game with its couplets or rounds. Nothing changes when it can't be read.
    @discardableResult
    func load(_ id: String) async -> FriendGame? {
        if let game = try? await session.authorized({ try await self.session.api.game(id: id, token: $0) }) {
            store(game)
        }
        return games[id]
    }

    /// The socket (re)connected: events were missed, so what is open is read again.
    func reconnected() async {
        await refreshMine()
        for game in games.values where game.status != .done { await load(game.id) }
    }

    // MARK: Playing

    /// Makes a game and sends the invitations. The line to show when it failed is the error's.
    func create(kind: FriendGame.Kind, turnSeconds: Int?, invite: [String]) async throws -> GameCreated {
        let made = try await session.authorized { try await self.session.api.createGame(kind: kind, turnSeconds: turnSeconds, invite: invite, token: $0) }
        store(made.game)
        return made
    }

    /// «بزن بریم»: takes the seat by the game's id. Returns the line to show when it failed.
    func join(_ id: String) async -> String? {
        do {
            let game = try await session.authorized { try await self.session.api.joinGame(id: id, token: $0) }
            store(game)
            return nil
        } catch let error as APIError {
            return PlayCopy.gameError(error)
        } catch {
            return nil
        }
    }

    /// Plays a couplet. Returns the line to show when the move was refused.
    func play(_ candidate: MoshCandidate, in id: String) async -> String? {
        let letter = games[id].flatMap { MoshState(game: $0, me: me ?? "").requiredLetter }
        do {
            let game = try await session.authorized {
                try await self.session.api.playMove(gameId: id, key: candidate.key, m1: candidate.couplet.m1, m2: candidate.couplet.m2, token: $0)
            }
            store(game)
            return nil
        } catch let error as APIError {
            if error.code == .turnOver || error.code == .notYourTurn || error.code == .gameNotActive { await load(id) }  // the game moved on
            return PlayCopy.moveError(error, letter: letter)
        } catch {
            return nil
        }
    }

    /// «کم آوردم»: the other player wins.
    func resign(_ id: String) async -> String? {
        do {
            let game = try await session.authorized { try await self.session.api.resign(gameId: id, token: $0) }
            store(game)
            return nil
        } catch let error as APIError {
            if error.code == .gameNotActive { await load(id) }
            return PlayCopy.moveError(error, letter: nil)
        } catch {
            return nil
        }
    }

    // MARK: رودررو

    /// The live state of a duel: what the events have told so far, or a fresh one from the game. A game that is done
    /// (read after a reconnect, or opened from a list) has its end from the game itself.
    func duel(_ id: String) -> DuelState? {
        guard let me, let game = games[id], let other = game.other(than: me) else { return nil }
        var state = duels[id] ?? DuelState(gameID: id, me: me, other: other.username)
        if game.status == .done, !state.isEnded, let reason = game.endReason {
            let scores = game.players.map { GameScore(username: $0.username, score: $0.score) }
            state.apply(.gameEnded(gameId: id, winner: game.winner, reason: reason, scores: scores, couplets: game.rounds))
        }
        return state
    }

    /// I choose an option: it is shown at once and sent over the socket.
    func answer(_ option: Int, in id: String) async {
        guard var state = duel(id), state.choose(option), let round = state.question?.round else { return }
        duels[id] = state
        _ = await sendLive?(LiveEvent.duelAnswerFrame(gameId: id, round: round, option: option))
    }

    // MARK: Events

    func handle(_ event: LiveEvent) {
        switch event {
        case .gameStarted(let game):
            store(game)
        case .gameMove(let id, let move, let scores):
            guard var game = games[id] else { return }
            if !game.moves.contains(where: { $0.n == move.n }) { game.moves.append(move) }
            apply(scores, to: &game)
            games[id] = game
        case .gameTurn(let id, let username, let deadline):
            games[id]?.turn = GameTurn(username: username, deadline: deadline)
        case .gameEnded(let id, let winner, let reason, let scores, let couplets):
            guard var game = games[id] else { return }
            game.status = .done
            game.winner = winner
            game.endReason = reason
            game.endedAt = now()
            game.turn = nil
            if !couplets.isEmpty { game.rounds = couplets }
            apply(scores, to: &game)
            games[id] = game
            applyToDuel(event, in: id)
        case .duelQuestion(let question):
            applyToDuel(event, in: question.gameId)
        case .duelAnswered(let id, _, _), .duelRound(let id, _, _, _, _):
            applyToDuel(event, in: id)
        case .challengeResult(_, _, let result):
            if result.username == nil { toast?("\(result.name) توی چالشت \(PersianDigits.string(result.score)) از ۱۰ گرفت") }
        default:
            break
        }
    }

    private func applyToDuel(_ event: LiveEvent, in id: String) {
        guard var state = duel(id) else { return }
        state.apply(event, now: now())
        duels[id] = state
    }

    private func apply(_ scores: [GameScore], to game: inout FriendGame) {
        for score in scores {
            if let index = game.players.firstIndex(where: { $0.username == score.username }) { game.players[index].score = score.score }
        }
    }

    /// Keeps what a list or an event brought, with the couplets and rounds the game already had when the new one has none.
    private func store(_ game: FriendGame) {
        var merged = game
        if let old = games[game.id] {
            if game.moves.isEmpty { merged.moves = old.moves }
            if game.rounds.isEmpty { merged.rounds = old.rounds }
        }
        games[game.id] = merged
        if let me, game.player(me) != nil, !mineIDs.contains(game.id) { mineIDs.insert(game.id, at: 0) }
    }

    /// Signed out: nothing of the account stays in memory.
    func reset() {
        games = [:]
        mineIDs = []
        duels = [:]
    }
}
