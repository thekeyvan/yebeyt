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
        @Environment(Library.self) private var library
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
                    if let items = ChallengeAccept.couplets(for: challenge, deck: deck, poets: Set(library.poets.map(\.slug))) {
                        if playing { play(challenge, items) } else { board(challenge) }
                    } else {
                        failure(PlayCopy.challengeNotOpened)  // never a round made of other couplets
                    }
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

        @ViewBuilder private func play(_ challenge: Challenge, _ items: [GameCouplet]) -> some View {
            let answer = ChallengeAnswer(accept: accept, challenge: challenge)
            switch challenge.game {
            case .jigsaw: JigsawScreen(start: .items(items), answering: answer)
            case .poet: QuizScreen(start: .poetItems(items), answering: answer)
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

    private enum Phase: Equatable { case starting, naming, sending, done, failed(String) }

    private var mine: Int { summary.right }
    private var theirs: Int { answering.challenge.score }
    private var creator: String { answering.challenge.creator.name }

    var body: some View {
        RoundEndScreen(summary: decorated) {
            switch phase {
            case .naming, .sending: nameCard
            case .failed(let line): retryCard(line)
            case .starting, .done: EmptyView()
            }
        }
        .task { await start() }
    }

    /// Before the result is in: «تموم شد!»; after it: «بردی!» and both scores.
    private var decorated: RoundSummary {
        var shown = summary
        shown.offer = nil  // answering a challenge is not making one
        shown.won = false  // nothing to celebrate before the result is in
        guard phase == .done else { return shown }
        let outcome = ChallengeAccept.outcome(mine: mine, theirs: theirs)
        shown.won = outcome == .won
        shown.title = PlayCopy.title(outcome, other: creator)
        shown.subtitle = PlayCopy.scores(mine: mine, name: creator, theirs: theirs)
        return shown
    }

    /// With an account the result goes at once; a guest is asked for a name first.
    private func start() async {
        guard phase == .starting else { return }
        if answering.accept.asksName { phase = .naming } else { await send() }
    }

    /// Sends the result once at a time. A guest whose send failed is back at the name (with the line); a signed-in player
    /// has no name to give and gets a retry.
    private func send() async {
        guard phase != .sending, phase != .done else { return }
        phase = .sending
        line = await answering.accept.post(score: mine, seconds: seconds, name: answering.accept.asksName ? name : nil)
        if let line { phase = answering.accept.asksName ? .naming : .failed(line) } else { phase = .done }
    }

    private func retryCard(_ line: String) -> some View {
        VStack(spacing: 10) {
            Text(line).font(.ui(13)).foregroundStyle(Tokens.Colors.fire).accessibilityIdentifier("challengeError")
            Button("دوباره") { Task { await send() } }
                .buttonStyle(GameBigButtonStyle(height: 56, border: 4, fontSize: 21))
                .accessibilityIdentifier("challengeResultRetry")
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3))
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
                .feedbackPrivate()
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
        .dismissesKeyboardOnTap()
    }
}
