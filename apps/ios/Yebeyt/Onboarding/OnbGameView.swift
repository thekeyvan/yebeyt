import SwiftUI

/// OnbGame: the first couplet to stick, in 30 seconds. It is جورچین بیت with one couplet, drawn with the game's own
/// card and sticker sheet. Winning earns +۵۰; running out of time just goes on to the account step.
struct OnbGameView: View {
    @Environment(OnboardingModel.self) private var onboarding
    @Environment(Taste.self) private var taste
    @Environment(GameDeck.self) private var deck
    @Environment(GameStats.self) private var stats
    @Environment(ScoreSync.self) private var scores
    @State private var game: OnboardingGame?
    @State private var slotFrames: [Int: CGRect] = [:]

    var body: some View {
        OnbScreen {
            OnbTopBar(current: 1) { onboarding.next() }
        } content: { density in
            VStack(spacing: density.gap) {
                heading(iconSize: density.gameIconSize)
                    .padding(.bottom, density.cardTagRoom)
                if let game { play(game) }
            }
            .coordinateSpace(name: JigsawSpace.name)
        } footer: {
            if let game {
                Button("بچسبون!") { game.check() }
                    .buttonStyle(OnbButtonStyle())
                    .disabled(!game.board.isFull || game.showsWrong)
                    .accessibilityIdentifier("onbCheck")
            }
        }
        .task { await run() }
        .sensoryFeedback(.error, trigger: game?.misses) { old, new in (new ?? 0) > (old ?? 0) }
        .onChange(of: game?.showsWrong) { _, shows in
            guard shows == true, let game else { return }
            UIAccessibility.post(notification: .announcement, argument: "نشد")
            Task {
                try? await Task.sleep(for: .seconds(1.1))  // long enough to see which words were wrong
                withAnimation(.snappy) { game.clearWrong() }
            }
        }
        .onChange(of: game?.outcome) { _, outcome in
            guard let outcome else { return }
            Task { await finish(won: outcome == .won) }
        }
    }

    private func heading(iconSize: CGFloat) -> some View {
        HStack(spacing: 12) {
            GameIcon(kind: .jigsaw, size: iconSize)
            VStack(alignment: .leading, spacing: 2) {
                Text("اولین بیتت رو بچسبون").font(.title(28)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                Text("برچسب‌ها رو بکن و به ترتیب بچسبون. ۳۰ ثانیه.").font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder private func play(_ game: OnboardingGame) -> some View {
        JigsawCard(board: game.board, revealed: game.outcome == .won || game.showsWrong, showsRightWord: game.outcome == .won, tapSlot: { position in game.edit { $0.tapSlot(position) } }, slotFrames: $slotFrames)
        Text(game.progressLine).font(.ui(13, weight: .bold))
        .foregroundStyle(Tokens.Colors.ink)
        .padding(.horizontal, 14).padding(.vertical, 4)
        .sticker(fill: Tokens.Colors.green, radius: Tokens.Sticker.Radius.pill, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.2))
        .accessibilityIdentifier("onbProgress")
        JigsawStickerSheet(
            stickers: game.board.onSheet, selected: game.board.selected,
            extras: game.board.question.stickers.count - game.board.question.missing.count,
            select: { sticker in game.edit { $0.select(sticker) } },
            drop: { sticker, point in drop(sticker, at: point, in: game) }
        )
    }

    private func drop(_ sticker: JigsawSticker, at point: CGPoint, in game: OnboardingGame) {
        guard let position = slotFrames.first(where: { $0.value.insetBy(dx: -8, dy: -8).contains(point) })?.key else { return }
        game.edit { $0.place(sticker, at: position) }
    }

    /// Builds the game and runs its clock.
    private func run() async {
        guard game == nil else { return }
        var generator = SeededGenerator(seed: .random(in: .min ... .max))
        guard let made = OnboardingGame.make(deck: deck, preferring: taste.poets, generator: &generator) else {
            onboarding.next()  // no couplet to play: on to the account step
            return
        }
        game = made
        while !Task.isCancelled, !made.isOver {
            try? await Task.sleep(for: .seconds(1))
            made.tick()
        }
    }

    /// A won game shows the stuck couplet for a moment first.
    private func finish(won: Bool) async {
        if won {
            stats.award(OnboardingGame.reward)
            scores.report(.onboarding, points: OnboardingGame.reward, keepWhileSignedOut: true)
            try? await Task.sleep(for: .milliseconds(900))
        }
        onboarding.gameEnded(won: won)
    }
}
