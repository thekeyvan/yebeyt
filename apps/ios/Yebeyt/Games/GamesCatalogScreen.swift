import SwiftUI

/// GamesCatalog: the nine games with their icons and what they are. Only the built games open; the others are dimmed.
struct GamesCatalogScreen: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ScreenHeader(title: "بازی‌ها")
                ForEach(GameKind.allCases, id: \.self) { kind in
                    card(kind)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }

    private func card(_ kind: GameKind) -> some View {
        Button { open(kind) } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    GameIcon(kind: kind, size: 44)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(kind.name).font(.title(22)).padding(.top, 3)
                        Text(kind.meta).font(.ui(11)).foregroundStyle(Tokens.Colors.muted)
                    }
                    Spacer(minLength: 0)
                }
                Text(kind.about).font(.ui(12.5)).lineSpacing(4).multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(Tokens.Colors.ink)
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 24).fill(Tokens.Colors.white)
                    .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3)
            }
            .opacity(kind.isBuilt ? 1 : 0.5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!kind.isBuilt)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("catalog-\(kind.rawValue)")
    }

    private func open(_ kind: GameKind) {
        switch kind {
        case .daily: app.play(.daily)
        case .jigsaw: app.play(.jigsaw(.deck))
        default: break
        }
    }
}
