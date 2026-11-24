import SwiftUI

/// A challenge being answered: the model that posts the result and the challenge itself.
struct ChallengeAnswer {
    let accept: ChallengeAccept
    let challenge: Challenge
}

/// ChallengeAccept: the board of a challenge opened by its link (here from a chat message or a debug route; Universal Links
/// come with the website). It plays exactly the maker's ten couplets, then posts the result.
struct ChallengeAcceptScreen: View {
    let code: String
    @Environment(Session.self) private var session

    var body: some View {
        Inner(code: code, session: session)
    }

    private struct Inner: View {
        @Environment(AppModel.self) private var app
        @Environment(GameDeck.self) private var deck
        @State private var accept: ChallengeAccept
        @State private var playing = false

        init(code: String, session: Session) {
            _accept = State(initialValue: ChallengeAccept(code: code, session: session))
        }

        var body: some View {
            Group {
                switch accept.phase {
                case .loading: GameLoadingView()
                case .failed(let line): failure(line)
                case .ready(let challenge):
                    if playing { play(challenge) } else { board(challenge) }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .dottedPaper()
            .task { await accept.load() }
        }

        private func failure(_ line: String) -> some View {
            VStack(spacing: 14) {
                HStack { GameCloseButton { app.closeGame() }; Spacer() }
                Spacer()
                Text(line).font(.ui(15)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center).accessibilityIdentifier("challengeFailed")
                Button("دوباره") { Task { await accept.load() } }.font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                Spacer()
            }
            .padding(.horizontal, 18).padding(.top, 8)
        }

        /// The ten couplets of the challenge, found in the game deck by their keys.
        private func couplets(_ challenge: Challenge) -> [GameCouplet] {
            let byKey = Dictionary(deck.couplets.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            return challenge.items.compactMap { byKey[$0] }
        }

        @ViewBuilder private func play(_ challenge: Challenge) -> some View {
            let answer = ChallengeAnswer(accept: accept, challenge: challenge)
            switch challenge.game {
            case .jigsaw: JigsawScreen(start: .items(couplets(challenge)), answering: answer)
            case .poet: QuizScreen(start: .poetItems(couplets(challenge)), answering: answer)
            }
        }

        // MARK: The board

        private func board(_ challenge: Challenge) -> some View {
            let name = challenge.creator.name
            return VStack(spacing: 14) {
                HStack {
                    RoundButton(label: "برگشت", action: { app.closeGame() }) {
                        LineIcon(shape: ChevronRightIcon(), size: 20, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.ink)
                    }
                    .accessibilityIdentifier("challengeBack")
                    Spacer()
                    Text(PlayCopy.fromLink(name)).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
                VStack(spacing: 10) {
                    Face(parts: challenge.creator.avatar, size: 104, border: 5)
                        .overlay(alignment: .bottomTrailing) {  // the physical left, as on the board
                            Text(PlayCopy.outOfTen(challenge.score)).font(.title(15)).foregroundStyle(Tokens.Colors.white)
                                .padding(.horizontal, 10).padding(.top, 2)
                                .sticker(fill: Tokens.Colors.fire, radius: 999, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.2))
                                .tilted(-8)
                                .offset(x: 10, y: 6)
                        }
                    Text(PlayCopy.waitingForYou(name)).font(.title(30)).foregroundStyle(Tokens.Colors.ink).multilineTextAlignment(.center)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("challengeTitle")
                    VStack(spacing: 0) {
                        Text(PlayCopy.sameTen)
                        Text(PlayCopy.toWin(over: challenge.score))
                    }
                    .font(.ui(14)).foregroundStyle(Tokens.Colors.muted).lineSpacing(6).multilineTextAlignment(.center)
                }
                .padding(.top, 18)
                HStack(spacing: 8) {
                    chip(challenge.game.name)
                    if let label = challenge.label { chip(label) }
                    chip(PlayCopy.aboutTwoMinutes)
                }
                Button("شروع کن") { playing = true }
                    .buttonStyle(GameBigButtonStyle(height: 60, border: 4, fontSize: 24))
                    .padding(.top, 8)
                    .accessibilityIdentifier("challengeStart")
                if accept.asksName { noAccountCard(name) }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("challengeAccept")
        }

        private func chip(_ text: String) -> some View {
            Text(text).font(.ui(12, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 12).padding(.vertical, 5)
                .background(Capsule().fill(Tokens.Colors.white))
        }

        private func noAccountCard(_ name: String) -> some View {
            VStack(alignment: .leading, spacing: 8) {
                Text(PlayCopy.noAccount).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                Text(PlayCopy.noAccountNote(name)).font(.ui(12.5)).foregroundStyle(Tokens.Colors.muted).lineSpacing(4)
            }
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 20).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.06), radius: 4, x: 0, y: 2))
        }
    }
}

/// The end of a challenge being answered: the result is posted (at once with an account; a guest gives a name first), then
/// the two scores and who won.
struct ChallengeEndScreen: View {
    let answering: ChallengeAnswer
    let summary: RoundSummary
    let seconds: Int
    @State private var phase = Phase.starting
    @State private var name = ""
    @State private var line: String?

    private enum Phase { case starting, naming, sending, done }

    private var mine: Int { summary.right }
    private var theirs: Int { answering.challenge.score }
    private var creator: String { answering.challenge.creator.name }

    var body: some View {
        RoundEndScreen(summary: decorated) {
            if phase == .naming || phase == .sending { nameCard }
        }
        .task { await start() }
    }

    /// Before the result is in: «تموم شد!»; after it: «بردی!» and both scores.
    private var decorated: RoundSummary {
        var shown = summary
        shown.offer = nil  // answering a challenge is not making one
        guard phase == .done else { return shown }
        shown.title = PlayCopy.title(ChallengeAccept.outcome(mine: mine, theirs: theirs), other: creator)
        shown.subtitle = PlayCopy.scores(mine: mine, name: creator, theirs: theirs)
        return shown
    }

    private func start() async {
        guard phase == .starting else { return }
        if answering.accept.asksName { phase = .naming; return }
        phase = .sending
        line = await answering.accept.post(score: mine, seconds: seconds, name: nil)
        phase = line == nil ? .done : .naming
    }

    private func send() async {
        phase = .sending
        line = await answering.accept.post(score: mine, seconds: seconds, name: name)
        phase = line == nil ? .done : .naming
    }

    private var nameCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(PlayCopy.namePrompt).font(.title(22)).foregroundStyle(Tokens.Colors.ink)
            Text("تا \(creator) نتیجه‌ت رو ببینه.").font(.ui(12.5)).foregroundStyle(Tokens.Colors.muted)
            TextField("", text: $name, prompt: Text("اسمت").foregroundStyle(Color(hex: 0x8A8698)))
                .font(.ui(15)).foregroundStyle(Tokens.Colors.ink)
                .submitLabel(.send)
                .onSubmit { Task { await send() } }
                .padding(.horizontal, 16).frame(height: 48)
                .background(Capsule().fill(Tokens.Colors.boardPaper))
                .accessibilityIdentifier("challengeName")
            if let line { Text(line).font(.ui(12)).foregroundStyle(Tokens.Colors.fire).accessibilityIdentifier("challengeError") }
            Button("بفرست") { Task { await send() } }
                .buttonStyle(GameBigButtonStyle(height: 56, border: 4, fontSize: 21))
                .disabled(phase == .sending)
                .accessibilityIdentifier("challengeSendName")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3))
    }
}
