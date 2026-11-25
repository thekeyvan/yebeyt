import SwiftUI

/// PlayDaily: the couplet with its blank, three tries, the letter keyboard and «بچسبون!». The same puzzle for
/// everyone on a Tehran day; every try is kept, so coming back later finds the same state.
struct DailyScreen: View {
    @Environment(AppModel.self) private var app
    @Environment(GameStats.self) private var stats
    @State private var session: DailySession
    @State private var sheetShown: Bool

    init(puzzle: DailyPuzzle, day: TehranDay, stats: GameStats) {
        let session = DailySession(puzzle: puzzle, day: day, stats: stats)
        _session = State(initialValue: session)
        _sheetShown = State(initialValue: session.isOver)
    }

    var body: some View {
        GeometryReader { screen in
            // The board's sizes need about 700 pt between the status bar and the home indicator; below that (an iPhone SE) set it tighter.
            page(DailyDensity(compact: screen.size.height < Self.compactBelow))
        }
    }

    private static let compactBelow: CGFloat = 700

    private func page(_ density: DailyDensity) -> some View {
        ZStack {
            ScrollView {
                VStack(spacing: density.gap) {
                    DailyCoupletCard(puzzle: session.puzzle, revealed: session.isOver, density: density)
                    DailyGrid(game: session.game, density: density)
                        .shake(session.game.misses)
                        // The last miss has the answer sheet's own error tap.
                        .sensoryFeedback(.error, trigger: session.game.misses) { old, new in new > old && !session.isOver }
                    DailyKeyboard(keys: session.puzzle.keys, marks: session.game.keyMarks, type: session.type, erase: session.erase, density: density)
                }
                .padding(.horizontal, 18)
                .padding(.top, 6)
                .padding(.bottom, density.contentBottomPadding)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollIndicators(.hidden)
            .stickyHeader { header }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                bottomBar.padding(.horizontal, 18).padding(.bottom, density.bottomPadding)
                    .frame(maxWidth: .infinity)
                    .background { DottedPaper().ignoresSafeArea(edges: .bottom) }  // what scrolls under the bar does not show through
            }
            .accessibilityHidden(sheetShown)
            if sheetShown {
                AnswerSheet(
                    couplet: session.puzzle.couplet, right: session.game.outcome == .solved,
                    title: session.game.outcome == .solved ? nil : "نه، این بود", correction: session.puzzle.word,
                    detail: session.game.outcome == .solved ? "+\(PersianDigits.string(session.game.points))" : nil,
                    buttonTitle: "برگرد", buttonIdentifier: "dailyBack", next: { app.closeGame() }, celebrates: true
                )
            }
        }
        .dottedPaper()
        .onChange(of: session.isOver) { _, over in
            guard over else { return }
            Task {
                try? await Task.sleep(for: .seconds(0.9))  // long enough to see the last row's colours
                withAnimation(.snappy) { sheetShown = true }
            }
        }
        #if DEBUG
        .task { session.autoplay(app.autoplay) }
        #endif
    }

    private var header: some View {
        HStack(spacing: 12) {
            GameCloseButton { app.closeGame() }
            GameIcon(kind: .daily, size: 44)
            VStack(alignment: .leading, spacing: 0) {
                Text("معمای امروز").font(.title(24)).foregroundStyle(Tokens.Colors.ink).padding(.top, 3)
                    .accessibilityAddTraits(.isHeader)
                Text("\(stats.today.line) · برای همه یکیه").font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
            if stats.streak > 0 {
                HStack(spacing: 4) {
                    FlameShape().fill(Tokens.Colors.white).frame(width: 16, height: 16)
                    Text("\(PersianDigits.string(stats.streak)) روز").font(.ui(15, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 11).padding(.vertical, 4)
                .sticker(fill: Tokens.Colors.fire, radius: Tokens.Sticker.Radius.pill, border: 3, shadow: ShadowToken(y: 2, blur: 8, opacity: 0.18))
                .accessibilityLabel("رشته‌ی \(PersianDigits.string(stats.streak)) روزه")
            }
        }
    }

    private var bottomBar: some View {
        HStack(spacing: 10) {
            Button("بچسبون!") { session.submit() }
                .buttonStyle(GameBigButtonStyle(height: 58, border: 4, fontSize: 22, shadow: ShadowToken(y: 6, blur: 16, opacity: 0.3)))
                .disabled(!session.game.canSubmit)
                .accessibilityIdentifier("submit")
            GameRoundButton(label: "یه حرف، \(PersianDigits.string(Scoring.dailyHintCost)) امتیاز", fill: Tokens.Colors.amber, bordered: true) { session.hint() } content: {
                BulbIcon(caption: "یه حرف")
            }
            .disabled(!session.game.canHint)
            .accessibilityIdentifier("hint")
        }
    }
}
