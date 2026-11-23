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
                    RoundEndScreen(session: session)
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
            HStack(spacing: 4) {
                LineIcon(shape: SVGShape(d: "M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0zM12 9v4l2.5 2M9.5 2.5h5"), size: 15, lineWidth: 2.4, fill: nil)
                Text(session.timeText).font(.ui(15, weight: .bold))
            }
            .foregroundStyle(Tokens.Colors.ink)
            .padding(.horizontal, 11).padding(.vertical, 6)
            .background(Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.14), radius: 4, x: 0, y: 2))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("زمان")
            .accessibilityValue(session.timeText)
            .accessibilityIdentifier("timer")
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

/// The ten dots: right couplets green, wrong ones red, the one in play lapis with a halo.
struct ProgressDots: View {
    let round: JigsawRound

    var body: some View {
        HStack {
            ForEach(round.questions.indices, id: \.self) { index in
                if index == 0 { dot(index) } else { Spacer(minLength: 0); dot(index) }
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 7)
        .frame(maxWidth: .infinity)
        .background(Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 4, x: 0, y: 2))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("بیت \(PersianDigits.string(min(round.answers.count + 1, round.questions.count))) از \(PersianDigits.string(round.questions.count))")
        .accessibilityIdentifier("progress")
    }

    @ViewBuilder private func dot(_ index: Int) -> some View {
        if index < round.answers.count {
            Circle().fill(round.answers[index].result.isRight ? Tokens.Colors.green : Tokens.Colors.fire).frame(width: 14, height: 14)
        } else if index == round.answers.count, !round.sheetOpen {
            Circle().fill(Tokens.Colors.lapis).frame(width: 18, height: 18)
                .background(Circle().fill(Color(hex: 0xD6D8FF)).frame(width: 24, height: 24))
        } else {
            Circle().fill(Tokens.Colors.trackLight).frame(width: 14, height: 14)
        }
    }
}
