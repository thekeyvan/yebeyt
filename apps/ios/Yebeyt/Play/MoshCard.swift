import SwiftUI

/// The مشاعره card of the بازی tab (GamesE): the game that is waiting for my answer, and «با یه دوست».
struct MoshCard: View {
    /// The game where it is my turn and the time runs out first; nil shows only the title and the button.
    let urgent: MoshState?
    let open: (String) -> Void
    let withFriend: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 0) {
                Text("مشاعره").font(.title(26)).padding(.top, 3).accessibilityAddTraits(.isHeader)
                Text("نوبتی بیت بگید، با آخرین حرفِ بیتِ قبلی").font(.ui(12, weight: .medium))
            }
            if let urgent { row(urgent) }
            Button(action: withFriend) {
                Text("با یه دوست").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    .frame(maxWidth: .infinity).frame(height: 40)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white.opacity(0.55)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("moshWithFriend")
        }
        .foregroundStyle(Tokens.Colors.ink)
        .padding(EdgeInsets(top: 14, leading: 14, bottom: 12, trailing: 14))
        .frame(maxWidth: .infinity, alignment: .leading)
        .sticker(fill: Tokens.Colors.amber, radius: 26, border: 5, shadow: ShadowToken(y: 3, blur: 24, opacity: 0.2))
        .overlay(alignment: .topTrailing) { GameIcon(kind: .mosh, size: 50).padding(.trailing, 12).offset(y: -16) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moshCard")
    }

    private func row(_ state: MoshState) -> some View {
        Button { open(state.game.id) } label: {
            HStack(spacing: 10) {
                Face(parts: state.other?.avatar, size: 44, border: 3)
                VStack(alignment: .leading, spacing: 0) {
                    Text(state.cardTitle).font(.ui(14, weight: .bold))
                    Text(state.turnLine).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text("جواب بده").font(.title(16)).foregroundStyle(Tokens.Colors.white)
                    .padding(EdgeInsets(top: 7, leading: 12, bottom: 3, trailing: 12))
                    .background(RoundedRectangle(cornerRadius: 12).fill(Tokens.Colors.lapis))
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 18).fill(Tokens.Colors.white))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("moshActive")
    }
}
