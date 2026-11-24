import SwiftUI

/// A game line of a chat: the مشاعره card of the Direct board, an invitation with «بزن بریم», or a line (a game that ended,
/// the result of a challenge). The game it names is read when the card shows, and live events keep it up to date.
struct GameCardView: View {
    let message: ChatMessage
    let other: ChatPerson
    @Environment(AppModel.self) private var app
    @Environment(FriendGames.self) private var games
    @Environment(Session.self) private var session

    private var gameID: String? { message.payload?.gameId }

    var body: some View {
        let game = gameID.flatMap { games.game($0) }
        let card = ChatGameLine.make(message: message, other: other, game: game, me: games.me ?? "", myID: session.user?.id)
        Group {
            switch card {
            case .mosh(let state, let id)?: moshCard(state, id: id)
            case .invite(let text, let button)?: invitation(text, button)
            case .line(let text)?: line(text)
            case nil: EmptyView()
            }
        }
        .task(id: gameID) {
            guard message.payload?.event == "game_invite", let gameID, games.game(gameID)?.status != .done else { return }
            await games.load(gameID)
        }
    }

    private var time: String { ChatTime.clock(message.createdAt) }

    // MARK: The مشاعره card

    private func moshCard(_ state: MoshState, id: String) -> some View {
        let mine = message.fromMe
        return VStack(alignment: mine ? .trailing : .leading, spacing: 6) {
            Group {
                if mine {
                    Text("تو یه مشاعره شروع کردی · \(time)")
                } else {
                    Text("\(Text(other.name).font(.ui(12, weight: .bold)).foregroundColor(Tokens.Colors.ink)) یه مشاعره شروع کرد · \(time)")
                }
            }
            .font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("مشاعره با \(other.name)").font(.title(20)).padding(.top, 3)
                    Spacer(minLength: 0)
                    Text("دور \(PersianDigits.string(state.round))").font(.ui(12, weight: .bold))
                        .padding(.horizontal, 10).padding(.vertical, 2)
                        .background(Capsule().fill(Tokens.Colors.white))
                }
                Text("هر کی یه بیت می‌گه که با آخرین حرفِ بیتِ قبلی شروع بشه.").font(.ui(12)).lineSpacing(3)
                if let last = state.lastMove { lastCouplet(last) }
                HStack {
                    Text(state.isDone ? (state.outcomeTitle ?? "") : state.turnLine).font(.ui(13, weight: .bold))
                        .accessibilityIdentifier("gameTurn-\(message.id)")
                    Spacer(minLength: 8)
                    Button { app.play(.mosh(id)) } label: {
                        Text(state.isMyTurn ? "جواب بده" : "ببین").font(.title(16)).foregroundStyle(Tokens.Colors.white)
                            .padding(EdgeInsets(top: 7, leading: 13, bottom: 3, trailing: 13))
                            .background(RoundedRectangle(cornerRadius: 12).fill(Tokens.Colors.lapis))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gameGo-\(message.id)")
                }
            }
            .foregroundStyle(Tokens.Colors.ink)
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
            .frame(width: 262)
            .sticker(fill: Tokens.Colors.amber, radius: 22, border: 5, shadow: ShadowToken(y: 3, blur: 24, opacity: 0.18))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("gameCard-\(message.id)")
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }

    /// The last couplet of the game, its last letter marked: the letter the answer starts with.
    private func lastCouplet(_ move: MoshMove) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(TextNormalizer.plain(move.m1))
            Text(MoshLastLetter.marked(TextNormalizer.plain(move.m2), highlight: true, background: Tokens.Colors.lapis, foreground: Tokens.Colors.white))
        }
        .font(.poem(15)).lineSpacing(4)
        .foregroundStyle(Tokens.Colors.ink)
        .padding(.horizontal, 12).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white))
    }

    // MARK: Invitation and lines

    private func invitation(_ text: String, _ button: ChatGameLine.Button?) -> some View {
        let mine = message.fromMe
        return VStack(alignment: mine ? .trailing : .leading, spacing: 6) {
            Text(mine ? "تو · \(time)" : "\(other.name) · \(time)").font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            HStack(spacing: 12) {
                Text(text).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let button {
                    Button { Task { await run(button.action) } } label: {
                        Text(button.title).font(.title(16)).foregroundStyle(Tokens.Colors.white)
                            .padding(EdgeInsets(top: 7, leading: 13, bottom: 3, trailing: 13))
                            .background(RoundedRectangle(cornerRadius: 12).fill(Tokens.Colors.lapis))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("gameGo-\(message.id)")
                }
            }
            .padding(14)
            .frame(width: 262)
            .sticker(fill: Tokens.Colors.white, radius: 22, border: 0, shadow: Tokens.Sticker.Shadow.card)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("gameCard-\(message.id)")
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }

    private func line(_ text: String) -> some View {
        Text(text).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            .padding(.horizontal, 12).padding(.vertical, 5)
            .background(Capsule().fill(Tokens.Colors.white.opacity(0.8)))
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text)
            .accessibilityIdentifier("gameLine-\(message.id)")
    }

    /// «بزن بریم» takes the seat and opens the game; a refusal («یکی دیگه زودتر اومده») is a toast.
    private func run(_ action: ChatGameLine.Button.Action) async {
        let duel = message.payload?.kind == "duel"
        switch action {
        case .join(let id):
            if let line = await games.join(id) { app.showToast(line); return }
            app.play(duel ? .duel(id) : .mosh(id))
        case .open(let id):
            app.play(duel ? .duel(id) : .mosh(id))
        }
    }
}
