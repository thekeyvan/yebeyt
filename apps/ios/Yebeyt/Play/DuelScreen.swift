import SwiftUI

/// PlayDuel: five rounds, eight seconds each, one question at a time over the live socket. The first right answer wins the
/// round; a wrong one locks me out of it. After round five the rounds come with their couplets and meanings.
struct DuelScreen: View {
    let gameID: String
    @Environment(AppModel.self) private var app
    @Environment(FriendGames.self) private var games
    @Environment(Library.self) private var library
    @State private var now = Date.now

    private var game: FriendGame? { games.game(gameID) }
    private var other: GamePlayer? { games.me.flatMap { game?.other(than: $0) } }
    private var state: DuelState? { games.duel(gameID) }

    var body: some View {
        Group {
            if let game, let state, state.isEnded,
               let summary = state.summary(otherName: other?.name ?? "", poetName: { library.poet(slug: $0)?.name ?? $0 }) {
                RoundEndScreen(summary: summary)
            } else if let game {
                play(game)
            } else {
                GameLoadingView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .dottedPaper()
        .task { await games.load(gameID) }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                now = .now
            }
        }
    }

    // MARK: The game

    private func play(_ game: FriendGame) -> some View {
        VStack(spacing: 14) {
            header(state)
            if game.status == .waiting {
                message(PlayCopy.waiting(for: ""), detail: PlayCopy.gameLink(game.code))
            } else if let state, let question = state.question {
                scoreCard(state, game)
                Text("این دور: \(question.kind.title)")
                    .font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                    .padding(.horizontal, 14).padding(.vertical, 4)
                    .background(Capsule().fill(Tokens.Colors.ink))
                    .accessibilityIdentifier("duelKind")
                questionCard(question)
                options(state, question)
                Spacer(minLength: 0)
                footer(state)
            } else {
                message(PlayCopy.duelWaiting(for: other?.name ?? ""), detail: nil)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .padding(.bottom, 26)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("duel")
    }

    private func message(_ text: String, detail: String?) -> some View {
        VStack(spacing: 8) {
            Spacer()
            Text(text).font(.title(26)).foregroundStyle(Tokens.Colors.ink).accessibilityIdentifier("duelWaiting")
            if let detail {
                Text(detail).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).environment(\.layoutDirection, .leftToRight)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func header(_ state: DuelState?) -> some View {
        HStack(spacing: 10) {
            GameCloseButton { app.closeGame() }
            GameIcon(kind: .duel, size: 40)
            Text("بازی رودررو").font(.title(22)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3).frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
            if let state, state.question != nil {
                Text(PersianDigits.clock(state.secondsLeft(now: now)))
                    .font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                    .padding(.horizontal, 12).padding(.vertical, 5)
                    .background(Capsule().fill(Tokens.Colors.fire))
                    .overlay(Capsule().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 4, x: 0, y: 2)
                    .accessibilityLabel("زمان")
                    .accessibilityIdentifier("duelTime")
            }
        }
    }

    // MARK: Scores

    private func scoreCard(_ state: DuelState, _ game: FriendGame) -> some View {
        HStack {
            player(name: "تو", parts: game.player(state.me)?.avatar, score: state.myScore, color: Tokens.Colors.amber, chip: false)
            Spacer(minLength: 0)
            VStack(spacing: 6) {
                Text("در برابر").font(.title(20)).foregroundStyle(Tokens.Colors.fire).padding(.top, 4)
                HStack(spacing: 4) {
                    ForEach(Array(state.segments.enumerated()), id: \.offset) { _, segment in
                        Capsule().fill(color(of: segment, state)).frame(width: segment == .current ? 30 : 24, height: 8)
                    }
                }
                Text("دور \(PersianDigits.string(max(state.round, 1))) از \(PersianDigits.string(DuelState.roundCount))")
                    .font(.ui(11)).foregroundStyle(Tokens.Colors.muted).accessibilityIdentifier("duelRound")
            }
            Spacer(minLength: 0)
            player(name: other?.name ?? "", parts: other?.avatar, score: state.theirScore, color: Tokens.Colors.magenta, chip: state.otherAnswered && !state.isRoundOver)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("duelScores")
    }

    private func color(of segment: DuelState.Segment, _ state: DuelState) -> Color {
        switch segment {
        case .won(let username): username == state.me ? Tokens.Colors.amber : Tokens.Colors.magenta
        case .nobody, .coming: Tokens.Colors.trackLight
        case .current: Tokens.Colors.lapis
        }
    }

    private func player(name: String, parts: AvatarParts?, score: Int, color: Color, chip: Bool) -> some View {
        VStack(spacing: 2) {
            Face(parts: parts, size: 54, border: 3)
            Text(name).font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
            Text(PersianDigits.string(score)).font(.title(28)).foregroundStyle(color)
                .shadow(color: Tokens.Colors.ink, radius: 0, x: 0.6, y: 0.6)
                .shadow(color: Tokens.Colors.ink, radius: 0, x: -0.6, y: -0.6)
                .frame(height: 28)
        }
        .accessibilityElement(children: .combine)
        .overlay(alignment: .topTrailing) {
            if chip {
                Text("جواب داد").font(.ui(10, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    .padding(.horizontal, 8).padding(.vertical, 1)
                    .sticker(fill: Tokens.Colors.green, radius: 999, border: 3, shadow: ShadowToken(y: 1, blur: 4, opacity: 0.15))
                    .tilted(6)
                    .fixedSize()
                    .offset(x: 14, y: -8)
                    .accessibilityIdentifier("duelAnswered")
            }
        }
    }

    // MARK: The question

    private func questionCard(_ question: DuelQuestion) -> some View {
        let couplet = GameCouplet(poem: "", index: 0, m1: question.m1, m2: question.m2 ?? "", meaning: nil, poetSlug: "", poetName: question.poet ?? "", bookTitle: "")
        return Group {
            switch question.kind {
            case .second: QuizCoupletCard(couplet: couplet, secondShown: false, tag: question.poet)
            case .poet: QuizCoupletCard(couplet: couplet)
            case .book: QuizCoupletCard(couplet: couplet, chip: library.poets.first { $0.name == question.poet })
            }
        }
    }

    @ViewBuilder private func options(_ state: DuelState, _ question: DuelQuestion) -> some View {
        switch question.kind {
        case .second:
            VStack(spacing: 10) {
                ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                    HemistichOptionRow(text: option, state: optionState(index, state), tap: { choose(index) }).accessibilityIdentifier("duelOption-\(index)")
                }
            }
        case .poet:
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 12) {
                ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                    PoetOptionCard(poet: library.poets.first { $0.name == option }, name: option, state: optionState(index, state), tap: { choose(index) })
                        .accessibilityIdentifier("duelOption-\(index)")
                }
            }
        case .book:
            let poet = library.poets.first { $0.name == question.poet }?.slug
            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                    BookOptionTile(
                        book: library.books.first { $0.title == option && $0.poet == poet }, title: option, state: optionState(index, state), tap: { choose(index) }
                    )
                    .accessibilityIdentifier("duelOption-\(index)")
                }
            }
            .padding(.horizontal, 6).padding(.top, 8)
        }
    }

    /// Before the result: my choice (lapis while it is on its way, red once it is known to be wrong); after it: the right
    /// one in green, my wrong one in red, the rest dimmed.
    private func optionState(_ index: Int, _ state: DuelState) -> OptionState {
        if let right = state.rightOption {
            if index == right { return .right }
            return state.chosen == index ? .wrong : .dimmed
        }
        if state.chosen == index { return state.lockedOut ? .wrong : .selected }
        return state.chosen != nil || state.lockedOut ? .dimmed : .idle
    }

    private func choose(_ index: Int) {
        Task { await games.answer(index, in: gameID) }
    }

    private func footer(_ state: DuelState) -> some View {
        let text = state.isRoundOver
            ? PlayCopy.duelRound(winner: state.roundWinner, me: state.me, otherName: other?.name ?? "")
            : "هر کی زودتر درست جواب بده، دور رو می‌بره. بعد از بازی، معنی همه‌ی بیت‌ها رو با هم می‌بینید."
        return Text(text)
            .font(.ui(12, weight: state.isRoundOver ? .bold : .regular)).foregroundStyle(Tokens.Colors.muted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("duelFooter")
    }
}
