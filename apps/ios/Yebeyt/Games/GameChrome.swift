import SwiftUI

/// The pieces the game screens share (JigsawE, PlayDaily, JigsawResult, ChallengeSend).

/// The round white close button at the start of a game's header: 44pt, an ×.
struct GameCloseButton: View {
    let action: () -> Void

    var body: some View {
        RoundButton(label: "بستن", action: action) {
            LineIcon(shape: CloseIcon(), size: 18, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.ink)
        }
        .accessibilityIdentifier("gameClose")
    }
}

/// «بچسبون!» and «بیت بعدی»: a big lapis button with a white border.
struct GameBigButtonStyle: ButtonStyle {
    var height: CGFloat = 60
    var border: CGFloat = 5
    var fontSize: CGFloat = 25
    var shadow = Tokens.Sticker.Shadow.card
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title(fontSize))
            .foregroundStyle(Tokens.Colors.white)
            .padding(.top, 4)
            .frame(maxWidth: .infinity, minHeight: height - 2 * border, maxHeight: height - 2 * border)
            .sticker(fill: Tokens.Colors.lapis, radius: 20, border: border, shadow: shadow)
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.45)
    }
}

/// The 58pt round button beside it: the bulb (amber) or shuffle (white).
struct GameRoundButton<Content: View>: View {
    let label: String
    var fill = Tokens.Colors.white
    var bordered = false
    let action: () -> Void
    @ViewBuilder let content: Content
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            content
                .frame(width: 58, height: 58)
                .background {
                    Circle().fill(bordered ? Tokens.Colors.white : fill).shadow(color: Tokens.Colors.ink.opacity(0.2), radius: 4, x: 0, y: 3)
                    if bordered { Circle().fill(fill).padding(4) }
                }
                .opacity(isEnabled ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// The bulb: its icon and, under it, a small label («یه حرف», «−۲۰»).
struct BulbIcon: View {
    let caption: String

    var body: some View {
        VStack(spacing: 1) {
            LineIcon(shape: SVGShape(d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"), size: 21, lineWidth: 2.3, fill: nil)
            Text(caption).font(.ui(10, weight: .bold, scaled: false))
        }
        .foregroundStyle(Tokens.Colors.ink)
    }
}

/// The amber score sticker: «+۳۶۰».
struct ScoreSticker: View {
    let points: Int
    var large = true

    var body: some View {
        Text("+\(PersianDigits.string(points))")
            .font(large ? .title(22) : .ui(15, weight: .bold))
            .foregroundStyle(Tokens.Colors.ink)
            .padding(.horizontal, large ? 13 : 12)
            .padding(.top, large ? 6 : 0)
            .padding(.vertical, 3)
            .sticker(fill: Tokens.Colors.amber, radius: Tokens.Sticker.Radius.pill, border: large ? 4 : 3, shadow: large ? ShadowToken(y: 3, blur: 8, opacity: 0.22) : Tokens.Sticker.Shadow.badge)
            .contentTransition(.numericText())
    }
}

/// A peeled corner at the bottom edge of a big card, as on JigsawE: one per screen.
struct PeeledCorner: View {
    var body: some View {
        Rectangle()
            .fill(LinearGradient(
                stops: [.init(color: Tokens.Colors.paper, location: 0), .init(color: Tokens.Colors.paper, location: 0.5), .init(color: Tokens.Colors.ring, location: 0.5), .init(color: Tokens.Colors.white, location: 0.9)],
                startPoint: UnitPoint(x: 0, y: 1), endPoint: UnitPoint(x: 1, y: 0)
            ))
            .frame(width: 26, height: 26)
            .clipShape(UnevenRoundedRectangle(bottomTrailingRadius: 26))  // trailing is the physical left in right-to-left
            .shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 2, x: 2, y: -2)
            .accessibilityHidden(true)
    }
}
