import SwiftUI

/// PlayMatch: the couplet with its hard words dotted, the words in one column and their meanings, shuffled, in the
/// other. Tap a word, then its meaning: a right pair turns green and is joined by a curve; a wrong meaning only shakes.
/// No clock; 10 points for each pair.
struct MatchScreen: View {
    @Environment(AppModel.self) private var app
    @Environment(PoetryStore.self) private var poetry
    @Environment(Library.self) private var library
    @Environment(GameStats.self) private var stats
    @State private var session: MatchSession?
    /// How many times each meaning was tapped wrong: a change makes it shake.
    @State private var shakes: [Int: Int] = [:]
    /// The meaning tapped wrong, red for a moment.
    @State private var wrongMeaning: Int?
    /// The sheet comes a moment after the last pair, so its curve can be seen.
    @State private var sheetShown = false

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
        .task { await begin() }
    }

    // MARK: Starting

    /// Five couplets of the glossary; their text comes from the bundled poems. Nothing to play closes the game.
    private func begin() async {
        guard session == nil else { return }
        var generator = SeededGenerator(seed: .random(in: .min ... .max))
        guard let glossary = try? Glossary() else {
            app.closeGame()
            return
        }
        var couplets: [String: GameCouplet] = [:]
        let candidates = Array(generator.shuffled(glossary.entries).prefix(MatchRound.questionCount * 2))
        for entry in candidates {
            guard let poem = try? await poetry.poem(path: entry.path), poem.couplets.indices.contains(entry.couplet) else { continue }
            let slug = entry.path.split(separator: "/").first.map(String.init) ?? ""
            let book = library.book(containing: entry.path)
            couplets[entry.id] = GameCouplet(
                poem: entry.path, index: entry.couplet, couplet: poem.couplets[entry.couplet], poetSlug: slug,
                poetName: library.poet(slug: slug)?.name ?? "", bookTitle: book?.title ?? "", bookPath: book?.path ?? ""
            )
        }
        guard let round = MatchRound.make(entries: candidates, couplet: { couplets[$0.id] }, generator: &generator) else {
            app.closeGame()
            return
        }
        let session = MatchSession(round: round, stats: stats)
        #if DEBUG
        session.autoplay(app.autoplay)
        #endif
        self.session = session
        sheetShown = session.round.sheetOpen
    }

    // MARK: Screen

    private func play(_ session: MatchSession) -> some View {
        let round = session.round
        return ZStack {
            ScrollView {
                VStack(spacing: 14) {
                    titleRow(round)
                    MatchCoupletCard(question: round.current)
                    MatchBoard(round: round, shakes: shakes, wrongMeaning: wrongMeaning, selectWord: { session.selectWord($0) }, pick: { pick($0, in: session) })
                    Text("واژه رو بزن، بعد معنیش رو. اشتباه کنی، فقط تکون می‌خوره.")
                        .font(.ui(12)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollIndicators(.hidden)
            .stickyHeader { HStack(spacing: 12) {
                GameCloseButton(asking: session.asksBeforeLeaving) { app.closeGame() }
                ProgressDots(
                    total: round.current.words.count, results: Array(repeating: true, count: round.matched.count),
                    sheetOpen: round.sheetOpen, noun: "جفت"
                )
            } }
            .accessibilityHidden(sheetShown)
            if sheetShown {
                AnswerSheet(
                    couplet: round.current.couplet, right: true, title: "آره، همینه!",
                    detail: "+\(PersianDigits.string(round.current.words.count * Scoring.matchPair))",
                    buttonTitle: "سؤال بعدی", buttonIdentifier: "matchNext",
                    next: { withAnimation(.snappy) { session.next() } }
                )
            }
        }
        .animation(.snappy, value: round.matched)
        .onChange(of: round.sheetOpen) { _, open in
            guard open else {
                sheetShown = false
                return
            }
            Task {
                try? await Task.sleep(for: .seconds(0.8))  // long enough to see the last pair join
                withAnimation(.snappy) { sheetShown = open }
            }
        }
    }

    private func pick(_ meaning: Int, in session: MatchSession) {
        guard session.pick(meaning: meaning) == .wrong else { return }
        shakes[meaning, default: 0] += 1
        withAnimation(.snappy) { wrongMeaning = meaning }
        Task {
            try? await Task.sleep(for: .seconds(0.7))
            withAnimation(.snappy) { if wrongMeaning == meaning { wrongMeaning = nil } }
        }
    }

    private func titleRow(_ round: MatchRound) -> some View {
        HStack(spacing: 12) {
            GameIcon(kind: .match, size: 50)
            VStack(alignment: .leading, spacing: -4) {
                Text(GameKind.match.name).font(.title(30)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                Text("هر واژه رو به معنیش وصل کن").font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
            ScoreSticker(points: round.points).tilted(-4).accessibilityIdentifier("score")
        }
    }
}
