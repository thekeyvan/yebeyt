import SwiftUI

/// GameLobby: the game, the turn time (مشاعره only), who to invite, and the link for those without the app.
struct LobbyScreen: View {
    let start: LobbyStart
    @Environment(Session.self) private var session

    var body: some View {
        LobbyBody(start: start, session: session)
    }
}

private struct LobbyBody: View {
    @Environment(AppModel.self) private var app
    @Environment(FriendGames.self) private var games
    @Environment(MessagesCenter.self) private var messages
    @State private var model: LobbyModel
    @State private var picking = false
    @State private var busy = false
    @State private var toast: String?

    init(start: LobbyStart, session: Session) {
        _model = State(initialValue: LobbyModel(start: start, session: session))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                header
                label("چی بازی کنیم؟")
                gameTiles
                if model.game.hasTurnTime { turnTime }
                inviteCard
                Button("بساز و دعوت کن") { Task { await submit() } }
                    .buttonStyle(GameBigButtonStyle(height: 56, border: 4, fontSize: 21))
                    .disabled(busy)
                    .accessibilityIdentifier("lobbyCreate")
                Text(footer)
                    .font(.ui(11.5)).foregroundStyle(Color(hex: 0x8A8698))
                    .frame(maxWidth: .infinity).multilineTextAlignment(.center)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("lobby")
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toast($toast)
        .sheet(isPresented: $picking) {
            PeoplePickSheet(title: "کی رو دعوت کنی؟") { person in model.add(person) ? nil : PlayCopy.tooManyInvites }
        }
        .task { await model.loadFriends() }
    }

    private var footer: String {
        switch model.game {
        case .mosh: PlayCopy.lobbyFooter
        case .duel: PlayCopy.lobbyDuelFooter
        case .jigsaw, .poet: PlayCopy.lobbyChallengeFooter
        }
    }

    private func label(_ text: String) -> some View {
        Text(text).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
    }

    private var header: some View {
        HStack(spacing: 12) {
            RoundButton(label: "برگشت", action: { app.closeGame() }) {
                LineIcon(shape: ChevronRightIcon(), size: 20, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.ink)
            }
            .accessibilityIdentifier("lobbyBack")
            Text("بازی با دوست").font(.title(28)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3).accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
        }
    }

    // MARK: Game and time

    private var gameTiles: some View {
        HStack(spacing: 8) {
            ForEach(LobbyGame.allCases, id: \.self) { game in
                let on = game == model.game
                Button { model.game = game } label: {
                    VStack(spacing: 6) {
                        GameIcon(kind: game.kind, size: 42)
                        Text(game.title).font(.ui(12, weight: on ? .bold : .medium)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(EdgeInsets(top: 10, leading: 4, bottom: 8, trailing: 4))
                    .background(RoundedRectangle(cornerRadius: 18).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.06), radius: 4, x: 0, y: 2))
                    .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(on ? Tokens.Colors.lapis : Tokens.Colors.white, lineWidth: 3))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
                .accessibilityLabel(game.title)
                .accessibilityIdentifier("lobbyGame-\(game.kind.rawValue)")
            }
        }
    }

    private var turnTime: some View {
        VStack(alignment: .leading, spacing: 7) {
            label("وقت هر نوبت")
            SegmentedControl(
                options: LobbyModel.turnChoices.map { ($0, PlayCopy.turnTime(seconds: $0)) }, selection: $model.turnSeconds,
                style: SegmentedStyle(track: Tokens.Colors.trackLight, trackRadius: 14, trackPadding: 4, itemRadius: 11, fontSize: 12.5, vertical: 7, horizontal: nil, spacing: 4),
                label: "وقت هر نوبت", idPrefix: "lobbyTurn"
            )
            Text("«تا فردا» یعنی هر وقت سرت خلوت شد جواب بدی؛ وقتی نوبتت شد، توی پیام‌ها می‌بینی.")
                .font(.ui(11.5)).foregroundStyle(Color(hex: 0x8A8698))
        }
    }

    // MARK: Who to invite

    private var inviteCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            label("کی رو دعوت کنی؟")
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(model.people, id: \.username) { person in personTile(person) }
                    moreTile
                }
                .padding(.vertical, 2)
            }
            .scrollIndicators(.hidden)
            if model.game.challenge == nil { linkBlock }
        }
        .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
        .background(RoundedRectangle(cornerRadius: 24).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3))
    }

    private func personTile(_ person: PersonShort) -> some View {
        let on = model.selected.contains(person.username)
        return Button {
            if !model.toggle(person.username) { toast = PlayCopy.tooManyInvites }
        } label: {
            VStack(spacing: 4) {
                FaceCircle(parts: person.avatar, size: 50)
                    .opacity(on ? 1 : 0.75)
                    .overlay(alignment: .bottomLeading) {
                        if on {
                            LineIcon(shape: CheckIcon(), size: 12, lineWidth: 3.6, fill: nil).foregroundStyle(Tokens.Colors.white)
                                .frame(width: 20, height: 20)
                                .background(Circle().fill(Tokens.Colors.lapis))
                                .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                                .offset(x: -2, y: 2)
                        }
                    }
                Text(person.name).font(.ui(12, weight: on ? .bold : .medium)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(person.name)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("lobbyPerson-\(person.username)")
    }

    private var moreTile: some View {
        Button { picking = true } label: {
            VStack(spacing: 4) {
                Text("+").font(.ui(22)).foregroundStyle(Tokens.Colors.muted)
                    .frame(width: 50, height: 50)
                    .overlay(Circle().strokeBorder(Color(hex: 0xB9B4C6), style: StrokeStyle(lineWidth: 2, dash: [4, 3])))
                Text("بیشتر").font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("lobbyMore")
    }

    private var linkBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Rectangle().fill(Color.clear).frame(height: 1)
                .overlay(Rectangle().stroke(Color(hex: 0xE6E1D6), style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
            HStack(alignment: .firstTextBaseline) {
                label("اپ رو نداره؟ لینک بفرست")
                Spacer(minLength: 8)
                Text(model.linkText).font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                    .environment(\.layoutDirection, .leftToRight)
                    .accessibilityIdentifier("lobbyLink")
            }
            ShareRow(style: .compact, prepare: prepareShare, copied: { toast = "کپی شد" })
            Text("با لینک، بدون نصب هم می‌تونه بیاد توی بازی.").font(.ui(11.5)).foregroundStyle(Color(hex: 0x8A8698)).lineSpacing(3)
        }
    }

    // MARK: Making

    /// A tap on a way to share the link makes the game first (the link has its code), with the invitations picked so far.
    private func prepareShare() async -> SharePayload? {
        do {
            guard let game = try await model.makeGame(using: games, sendText: { await messages.sendText($0, to: $1) }) else { return nil }
            if let line = model.skippedLine { toast = line }
            let url = "https://\(PlayCopy.gameLink(game.code))"
            return SharePayload(text: PlayCopy.gameShare(game: model.game.kind.name, url: url), url: url)
        } catch let error as APIError {
            toast = PlayCopy.gameError(error)
            return nil
        } catch {
            return nil
        }
    }

    private func submit() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        switch model.plan {
        case .challenge(let game, let invite):
            app.play(.challengeRound(game, invite: invite))
        case .friendGame(let kind, _, _):
            do {
                guard let game = try await model.makeGame(using: games, sendText: { await messages.sendText($0, to: $1) }) else { return }
                if let line = model.skippedLine { app.showToast(line) }  // shown over the game
                app.play(kind == .duel ? .duel(game.id) : .mosh(game.id))
            } catch let error as APIError {
                toast = PlayCopy.gameError(error)
            } catch {}
        }
    }
}
