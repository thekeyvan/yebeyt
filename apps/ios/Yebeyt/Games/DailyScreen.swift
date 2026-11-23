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
        ZStack {
            VStack(spacing: 14) {
                header
                DailyCoupletCard(puzzle: session.puzzle, revealed: session.isOver)
                DailyGrid(game: session.game)
                DailyKeyboard(keys: session.puzzle.keys, marks: session.game.keyMarks, type: session.type, erase: session.erase)
                Spacer(minLength: 0)
                bottomBar
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 26)
            .accessibilityHidden(sheetShown)
            if sheetShown {
                AnswerSheet(
                    couplet: session.puzzle.couplet, right: session.game.outcome == .solved,
                    detail: session.game.outcome == .solved ? "+\(PersianDigits.string(session.game.points))" : nil,
                    buttonTitle: "برگرد", buttonIdentifier: "dailyBack", next: { app.closeGame() }
                )
                .transition(.opacity)
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
            GameRoundButton(label: "یه حرف، ۲۰ امتیاز", fill: Tokens.Colors.amber, bordered: true) { session.hint() } content: {
                BulbIcon(caption: "یه حرف")
            }
            .disabled(!session.game.canHint)
            .accessibilityIdentifier("hint")
        }
    }
}
