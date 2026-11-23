import SwiftUI

/// PlayPoet, PlaySecond, PlayBook and PlayListen: one question at a time with its options, «همینه!» to confirm,
/// ۵۰:۵۰ (or «یه کلمه» in گوش کن), the clock of the game, and the sheet after every answer. Nothing teaches while
/// the clock runs: the meaning waits in the sheet.
struct QuizScreen: View {
    let start: QuizStart
    @Environment(AppModel.self) private var app
    @Environment(PoetryStore.self) private var poetry
    @Environment(Library.self) private var library
    @Environment(GameDeck.self) private var deck
    @Environment(GameStats.self) private var stats
    @Environment(\.scenePhase) private var scenePhase
    @State private var session: QuizSession?
    @State private var audio = ListenAudio()
    @State private var toast: String?

    private var kind: GameKind { start.kind }

    /// Ganjoor's recitations; in a debug run with `-beytStub 1` canned ones, so the simulator needs no network.
    private var listenLoader: ListenLoader {
        #if DEBUG
        if app.autoplay.stubsRecitations { return .stub(store: poetry) }
        #endif
        return .live(store: poetry)
    }

    var body: some View {
        ZStack {
            if let session {
                if session.finished {
                    RoundEndScreen(summary: session.round.summary)
                } else {
                    play(session)
                }
            } else {
                GameLoadingView()
            }
        }
        .overlay(alignment: .bottom) { toastView }
        .animation(.snappy, value: toast)
        .task { await begin() }
        .onChange(of: scenePhase) { _, phase in session?.isPaused = phase != .active }
        .onDisappear { audio.stop() }
    }

    // MARK: Starting

    private func begin() async {
        guard session == nil else { return }
        var generator = SeededGenerator(seed: .random(in: .min ... .max))
        let round: QuizRound?
        switch start {
        case .poet: round = .poet(deck: deck, poets: library.poets, generator: &generator)
        case .misra(let poet): round = .second(deck: deck, only: poet, generator: &generator)
        case .book: round = .book(deck: deck, books: library.books, generator: &generator)
        case .listen:
            let questions = await listenLoader.questions(deck: deck, count: 5, generator: &generator)
            round = QuizRound(kind: .listen, questions: questions)
        }
        guard let round else {
            if kind == .listen { await recitationsFailed() } else { app.closeGame() }
            return
        }
        let session = QuizSession(round: round, stats: stats)
        #if DEBUG
        session.autoplay(app.autoplay)
        #endif
        self.session = session
        audio.onFailure = { Task { await recitationsFailed() } }
        if kind == .listen { startClip(session) }
        await runClock(session)
    }

    private func runClock(_ session: QuizSession) async {
        while !Task.isCancelled, !session.finished, session.round.clock != .none {
            try? await Task.sleep(for: .seconds(1))
            session.tick()
        }
    }

    /// «خوانش باز نشد» and back to the tab.
    private func recitationsFailed() async {
        toast = "خوانش باز نشد"
        try? await Task.sleep(for: .seconds(1.6))
        app.closeGame()
    }

    @ViewBuilder private var toastView: some View {
        if let toast {
            Text(toast)
                .font(.ui(13, weight: .medium))
                .foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 16).padding(.vertical, 9)
                .background(Capsule().fill(Tokens.Colors.ink))
                .padding(.bottom, 96)
                .transition(.opacity)
                .accessibilityIdentifier("toast")
        }
    }

    // MARK: Screen

    private func play(_ session: QuizSession) -> some View {
        let round = session.round
        return ZStack {
            ScrollView {
                VStack(spacing: 14) {
                    header(session)
                    titleRow(round)
                    content(session)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 16)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollIndicators(.hidden)
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomBar(session) }
            .accessibilityHidden(round.sheetOpen)
            if let answer = round.lastAnswer {
                AnswerSheet(
                    couplet: round.current.couplet, right: answer.right, title: round.current.verdict(right: answer.right),
                    detail: detail(answer, in: round), buttonTitle: "سؤال بعدی", buttonIdentifier: "quizNext",
                    next: { withAnimation(.snappy) { session.next() } }
                )
                .transition(.opacity)
            }
        }
        .animation(.snappy, value: round.sheetOpen)
        .onChange(of: round.index) { _, _ in if kind == .listen { startClip(session) } }
    }

    /// «+۳۰ · ۷ ثانیه»; a wrong answer is not counted.
    private func detail(_ answer: QuizRound.Answer, in round: QuizRound) -> String {
        guard answer.right else { return "این یکی رو حساب نکردیم" }
        let points = "+\(PersianDigits.string(answer.points))"
        return round.clock == .none ? points : "\(points) · \(PersianDigits.string(answer.seconds)) ثانیه"
    }

    private func header(_ session: QuizSession) -> some View {
        HStack(spacing: 12) {
            GameCloseButton { app.closeGame() }
            ProgressDots(total: session.round.questions.count, results: session.round.results, sheetOpen: session.round.sheetOpen, noun: "سؤال")
            if let time = session.timeText { TimerCapsule(text: time) }
        }
    }

    private func titleRow(_ round: QuizRound) -> some View {
        HStack(spacing: 12) {
            GameIcon(kind: kind, size: 50)
            VStack(alignment: .leading, spacing: -4) {
                Text(kind.name).font(.title(30)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                Text(QuizCopy.subtitle(for: kind, poetName: round.current.couplet.poetName)).font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
            ScoreSticker(points: round.points).tilted(-4).accessibilityIdentifier("score")
        }
    }

    // MARK: The question

    @ViewBuilder private func content(_ session: QuizSession) -> some View {
        let round = session.round, question = round.current
        let answered = round.sheetOpen
        switch kind {
        case .poet:
            QuizCoupletCard(couplet: question.couplet)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 12) {
                ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                    PoetOptionCard(poet: library.poet(slug: option.id), name: option.title, state: state(index, round), tap: { session.select(index) })
                        .accessibilityIdentifier("option-\(index)")
                }
            }
        case .misra:
            QuizCoupletCard(couplet: question.couplet, secondShown: answered, tag: question.couplet.poetName)
            hemistichOptions(session)
        case .book:
            QuizCoupletCard(couplet: question.couplet, chip: library.poet(slug: question.couplet.poetSlug))
            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(question.options.enumerated()), id: \.offset) { index, option in
                    BookOptionTile(book: library.book(path: option.id), title: option.title, state: state(index, round), tap: { session.select(index) })
                        .accessibilityIdentifier("option-\(index)")
                }
            }
            .padding(.horizontal, 6).padding(.top, 8)
        case .listen:
            if answered {
                QuizCoupletCard(couplet: question.couplet)
            } else {
                ListenCard(
                    playing: audio.isPlaying, progress: audio.progress, replaysLeft: round.replaysLeft,
                    playOrPause: { playOrPause(session) }, replay: { replay(session) }
                )
            }
            hemistichOptions(session)
        default:
            EmptyView()
        }
    }

    private func hemistichOptions(_ session: QuizSession) -> some View {
        let round = session.round
        let marked = round.wordShown ? round.current.hintWord : nil
        return VStack(spacing: 10) {
            ForEach(Array(round.current.options.enumerated()), id: \.offset) { index, option in
                HemistichOptionRow(
                    text: option.title, state: state(index, round), markedWord: index == round.current.correct ? marked : nil,
                    tap: { session.select(index) }
                )
                .accessibilityIdentifier("option-\(index)")
            }
        }
    }

    private func state(_ index: Int, _ round: QuizRound) -> OptionState {
        if let answer = round.lastAnswer {
            if index == round.current.correct { return .right }
            return answer.chosen == index ? .wrong : .dimmed
        }
        if round.removed.contains(index) { return .removed }
        return round.selected == index ? .selected : .idle
    }

    // MARK: Bottom bar

    private func bottomBar(_ session: QuizSession) -> some View {
        let round = session.round
        let listen = kind == .listen
        return HStack(spacing: 10) {
            Button("همینه!") {
                session.confirm()
                audio.stop()
            }
            .buttonStyle(GameBigButtonStyle(height: 58, border: 4, fontSize: 22))
            .disabled(round.selected == nil || round.sheetOpen)
            .accessibilityIdentifier("quizConfirm")
            if listen {
                GameRoundButton(label: "از اول", action: { replay(session) }) {
                    LineIcon(shape: SVGShape(d: Self.skipIcon), size: 22, lineWidth: 2.4, fill: nil).foregroundStyle(Tokens.Colors.ink)
                }
                .disabled(round.replaysLeft == 0 || round.sheetOpen)
                .accessibilityIdentifier("listenFromStart")
            } else if round.kind != .book {
                GameRoundButton(label: "رد کن", action: { session.skip() }) {
                    LineIcon(shape: SVGShape(d: Self.skipIcon), size: 22, lineWidth: 2.4, fill: nil).foregroundStyle(Tokens.Colors.ink)
                }
                .disabled(!round.canSkip)
                .accessibilityIdentifier("quizSkip")
            }
            if round.kind != .book {
                GameRoundButton(
                    label: listen ? "یه کلمه، \(PersianDigits.string(Scoring.quizHintCost)) امتیاز" : "راهنما، ۵۰:۵۰، \(PersianDigits.string(Scoring.quizHintCost)) امتیاز",
                    fill: Tokens.Colors.amber, bordered: true,
                    action: { if listen { session.showWord() } else { session.fifty() } }
                ) {
                    BulbIcon(caption: listen ? "یه کلمه" : "۵۰:۵۰")
                }
                .disabled(listen ? !round.canShowWord : !round.canFifty)
                .accessibilityIdentifier(listen ? "listenWord" : "fifty")
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .padding(.bottom, 26)
    }

    /// The bar and arrow of the board's «رد کن» and «از اول».
    private static let skipIcon = "M18 6l-8 6 8 6zM6 6v12"

    // MARK: The clip of گوش کن

    /// The question's clip, played at once.
    private func startClip(_ session: QuizSession) {
        guard !session.round.sheetOpen else { return audio.start(nil) }
        #if DEBUG
        if app.autoplay.stubsRecitations { return audio.start(nil) }  // canned recitations have no audio
        #endif
        audio.start(session.round.current.clip)
    }

    private func playOrPause(_ session: QuizSession) {
        if audio.isIdle { replay(session) } else { audio.toggle() }
    }

    /// «دوباره بشنو»: the first hemistich again from its start, once for each question.
    private func replay(_ session: QuizSession) {
        if session.useReplay() { audio.restart() }
    }
}
