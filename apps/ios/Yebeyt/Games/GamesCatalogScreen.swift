import SwiftUI

/// GamesCatalog: the nine games as a grid of cards, each with its sticker, name, line and a small picture of the game.
/// Three across at the default text size, two as it grows and one at the accessibility sizes. The two with friends
/// open the lobby (after the account gate).
struct GamesCatalogScreen: View {
    @Environment(AppModel.self) private var app
    @Environment(AccountModel.self) private var account
    @Environment(\.dynamicTypeSize) private var textSize

    /// How many cards fit in a row at a text size, so nothing is cut off.
    nonisolated static func columns(for size: DynamicTypeSize) -> Int {
        if size.isAccessibilitySize { 1 } else if size > .large { 2 } else { 3 }
    }

    nonisolated static func rows(_ kinds: [GameKind], columns: Int) -> [[GameKind]] {
        stride(from: 0, to: kinds.count, by: columns).map { Array(kinds[$0..<min($0 + columns, kinds.count)]) }
    }

    var body: some View {
        ScrollView {
            Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                ForEach(Array(Self.rows(GameKind.allCases, columns: Self.columns(for: textSize)).enumerated()), id: \.offset) { _, row in
                    GridRow {
                        ForEach(row, id: \.self) { kind in card(kind) }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { ScreenHeader(title: "بازی‌ها") }
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }

    private func card(_ kind: GameKind) -> some View {
        Button { open(kind) } label: {
            VStack(alignment: .leading, spacing: 6) {
                header(kind)
                Spacer(minLength: 4)
                GamePreview(kind: kind)
            }
            .foregroundStyle(Tokens.Colors.ink)
            .padding(10)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background {
                RoundedRectangle(cornerRadius: Tokens.Sticker.Radius.card).fill(Tokens.Colors.white)
                    .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.press)
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("\(kind.name)، \(kind.meta)")
        .accessibilityHint(kind.about)
        .accessibilityIdentifier("catalog-\(kind.rawValue)")
    }

    /// The sticker, the name and the line: stacked in a narrow card, side by side when the card is a whole row.
    @ViewBuilder private func header(_ kind: GameKind) -> some View {
        let texts = VStack(alignment: .leading, spacing: 0) {
            Text(kind.name).font(.title(19)).padding(.top, 3)
            Text(kind.meta).font(.ui(10.5)).foregroundStyle(Tokens.Colors.muted)
        }
        .multilineTextAlignment(.leading)
        .fixedSize(horizontal: false, vertical: true)
        if Self.columns(for: textSize) == 1 {
            HStack(spacing: 12) { GameIcon(kind: kind, size: 44); texts; Spacer(minLength: 0) }
        } else {
            VStack(alignment: .leading, spacing: 6) { GameIcon(kind: kind, size: 40); texts }
        }
    }

    private func open(_ kind: GameKind) {
        if kind == .mosh || kind == .duel {
            account.require(.games) { app.play(kind.route) }
        } else {
            app.play(kind.route)
        }
    }
}
