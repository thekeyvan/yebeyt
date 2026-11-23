import SwiftUI

/// JigsawE: ten couplets in two minutes. The first hemistich is whole, the second is word slots; stickers from the
/// sheet go into them. Nothing teaches while the clock runs: the meaning waits in the sheet after each answer.
struct JigsawScreen: View {
    let start: JigsawStart
    @Environment(AppModel.self) private var app
    @Environment(PoetryStore.self) private var poetry
    @Environment(Library.self) private var library
    @Environment(GameDeck.self) private var deck
    @Environment(GameStats.self) private var stats
    @Environment(\.scenePhase) private var scenePhase
    @State private var session: JigsawSession?
    @State private var slotFrames: [Int: CGRect] = [:]

    var body: some View {
        ZStack {
            if let session {
                if session.finished {
                    RoundEndScreen(summary: session.round.summary)
                } else {
                    play(session)
                }
            }
        }
        .coordinateSpace(name: JigsawSpace.name)
        .dottedPaper()
        .task { await begin() }
        .onChange(of: scenePhase) { _, phase in session?.isPaused = phase != .active }
    }

    /// Builds the round; the couplets of a poem of the reader come first. A poem that can't be loaded just
    /// leaves a round from the deck.
    private func begin() async {
        guard session == nil else { return }
        var opening: [GameCouplet] = []
        switch start {
        case .deck: break
        case .couplet(let path, _), .poem(let path):
            if let poem = try? await poetry.poem(path: path) {
                let slug = path.split(separator: "/").first.map(String.init) ?? ""
                opening = start.opening(
                    from: poem, poetSlug: slug, poetName: library.poet(slug: slug)?.name ?? "",
                    bookTitle: library.book(containing: path)?.title ?? ""
                )
            }
        }
        var generator = SeededGenerator(seed: .random(in: .min ... .max))
        guard let round = JigsawRound.make(opening: opening, deck: deck, generator: &generator) else { return }
        let session = JigsawSession(round: round, stats: stats)
        #if DEBUG
        session.autoplay(app.autoplay)
        #endif
        self.session = session
        await runClock(session)
    }

    private func runClock(_ session: JigsawSession) async {
        while !Task.isCancelled, !session.finished {
            try? await Task.sleep(for: .seconds(1))
            session.tick()
        }
    }

    private func play(_ session: JigsawSession) -> some View {
        let round = session.round
        return ZStack {
            ScrollView {
                VStack(spacing: 16) {
                    header(session)
                    titleRow(round)
                    JigsawCard(
                        board: round.board, revealed: round.sheetOpen,
                        tapSlot: { position in session.edit { $0.tapSlot(position) } }, slotFrames: $slotFrames
                    )
                    combo(round)
                    JigsawStickerSheet(
                        stickers: round.board.onSheet, selected: round.board.selected,
                        extras: round.current.stickers.count - round.current.missing.count,
                        select: { sticker in session.edit { $0.select(sticker) } },
                        drop: { sticker, point in drop(sticker, at: point, in: session) }
                    )
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
                    couplet: round.current.couplet, right: answer.result.isRight,
                    detail: "+\(PersianDigits.string(answer.result.points)) · \(PersianDigits.string(answer.seconds)) ثانیه",
                    buttonTitle: "بیت بعدی", buttonIdentifier: "jigsawNext", next: { withAnimation(.snappy) { session.next() } }
                )
                .transition(.opacity)
            }
        }
        .animation(.snappy, value: round.sheetOpen)
    }

    private func drop(_ sticker: JigsawSticker, at point: CGPoint, in session: JigsawSession) {
        guard let position = slotFrames.first(where: { $0.value.insetBy(dx: -8, dy: -8).contains(point) })?.key else { return }
        session.edit { $0.place(sticker, at: position) }
    }

    // MARK: Pieces

    private func header(_ session: JigsawSession) -> some View {
        HStack(spacing: 12) {
            GameCloseButton { app.closeGame() }
            ProgressDots(round: session.round)
            TimerCapsule(text: session.timeText)
        }
    }

    private func titleRow(_ round: JigsawRound) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                Text("جورچین بیت").font(.title(32)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                Text("برچسب‌ها رو بکَن، بچسبون سر جاشون").font(.ui(15)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
            ScoreSticker(points: round.points).accessibilityIdentifier("score")
        }
    }

    /// «سه تا پشت سر هم درست!» after three right couplets in a row. Its place stays, so nothing jumps.
    private func combo(_ round: JigsawRound) -> some View {
        HStack(spacing: 6) {
            LineIcon(shape: CheckIcon(), size: 16, lineWidth: 2.8, fill: nil)
            Text("سه تا پشت سر هم درست!").font(.ui(14, weight: .bold))
        }
        .foregroundStyle(Tokens.Colors.ink)
        .padding(.horizontal, 14).padding(.vertical, 4)
        .sticker(fill: Tokens.Colors.green, radius: Tokens.Sticker.Radius.pill, border: 4, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.2))
        .opacity(round.combo >= JigsawRound.comboLength && !round.sheetOpen ? 1 : 0)
        .accessibilityHidden(round.combo < JigsawRound.comboLength)
        .accessibilityIdentifier("combo")
    }

    private func bottomBar(_ session: JigsawSession) -> some View {
        let board = session.round.board
        return HStack(spacing: 12) {
            GameRoundButton(label: "راهنما، \(PersianDigits.string(Scoring.jigsawHintCost)) امتیاز", fill: Tokens.Colors.amber, bordered: true) { session.edit { $0.hint() } } content: {
                BulbIcon(caption: "−\(PersianDigits.string(Scoring.jigsawHintCost))")
            }
            .disabled(!board.canHint)
            .accessibilityIdentifier("jigsawHint")
            GameRoundButton(label: "بُر زدن برچسب‌ها", action: { session.shuffle() }) {
                LineIcon(shape: SVGShape(d: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"), size: 22, lineWidth: 2.4, fill: nil)
                    .foregroundStyle(Tokens.Colors.ink)
            }
            .accessibilityIdentifier("jigsawShuffle")
            Button("بچسبون!") { session.check() }
                .buttonStyle(GameBigButtonStyle())
                .disabled(!board.isFull)
                .accessibilityIdentifier("jigsawCheck")
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .padding(.bottom, 26)
    }
}

/// The dots of a round, one for each question: right ones green, wrong ones red, the one in play lapis with a halo.
struct ProgressDots: View {
    let total: Int
    /// One for each question passed: right, wrong, or nil for a skipped one (a grey dot).
    let results: [Bool?]
    /// The sheet of the last answer is open, so no dot is «in play».
    let sheetOpen: Bool
    /// «بیت ۴ از ۱۰», «سؤال ۴ از ۱۰», «جفت ۳ از ۵».
    let noun: String

    init(round: JigsawRound) {
        self.init(total: round.questions.count, results: round.answers.map { $0.result.isRight }, sheetOpen: round.sheetOpen)
    }

    init(total: Int, results: [Bool?], sheetOpen: Bool, noun: String = "بیت") {
        self.total = total
        self.results = results
        self.sheetOpen = sheetOpen
        self.noun = noun
    }

    var body: some View {
        HStack {
            ForEach(0..<total, id: \.self) { index in
                if index == 0 { dot(index) } else { Spacer(minLength: 0); dot(index) }
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .frame(maxWidth: .infinity)
        .background(Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 4, x: 0, y: 2))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(noun) \(PersianDigits.string(min(results.count + 1, total))) از \(PersianDigits.string(total))")
        .accessibilityIdentifier("progress")
    }

    @ViewBuilder private func dot(_ index: Int) -> some View {
        if index < results.count {
            let color = results[index].map { $0 ? Tokens.Colors.green : Tokens.Colors.fire } ?? Tokens.Colors.trackLight
            Circle().fill(color).frame(width: 14, height: 14)
        } else if index == results.count, !sheetOpen {
            Circle().fill(Tokens.Colors.lapis).frame(width: 18, height: 18)
                .background(Circle().fill(Color(hex: 0xD6D8FF)).frame(width: 24, height: 24))
        } else {
            Circle().fill(Tokens.Colors.trackLight).frame(width: 14, height: 14)
        }
    }
}
