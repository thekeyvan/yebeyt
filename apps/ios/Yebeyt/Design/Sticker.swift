import SwiftUI

extension View {
    func stickerShadow(_ token: ShadowToken) -> some View {
        shadow(color: Tokens.Colors.ink.opacity(token.opacity), radius: token.blur / 2, x: 0, y: token.y)
    }

    /// A sticker: `fill` with a white border and a soft shadow. Like CSS, the border sits inside the
    /// outer edge and the content's own padding goes inside the border.
    func sticker(fill: Color, radius: CGFloat, border: CGFloat, shadow: ShadowToken) -> some View {
        padding(border)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: radius).fill(Tokens.Colors.white).stickerShadow(shadow)
                    RoundedRectangle(cornerRadius: max(radius - border, 0)).fill(fill).padding(border)
                }
            }
    }

    /// A white card: straight, white border, soft shadow, no outline.
    func stickerCard(fill: Color = Tokens.Colors.white) -> some View {
        sticker(fill: fill, radius: Tokens.Sticker.Radius.card, border: Tokens.Sticker.BorderWidth.card, shadow: Tokens.Sticker.Shadow.card)
    }
}

/// «بزن بریم» (primary: lapis, white text, white border) and «بعداً» (secondary: white).
struct StickerButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary }
    let kind: Kind

    func makeBody(configuration: Configuration) -> some View {
        let primary = kind == .primary
        configuration.label
            .font(.title(21))
            .foregroundStyle(primary ? Tokens.Colors.white : Tokens.Colors.ink)
            .padding(primary ? EdgeInsets(top: 9, leading: 22, bottom: 5, trailing: 22) : EdgeInsets(top: 12, leading: 22, bottom: 8, trailing: 22))
            .sticker(fill: primary ? Tokens.Colors.lapis : Tokens.Colors.white,
                     radius: Tokens.Sticker.Radius.button,
                     border: primary ? Tokens.Sticker.BorderWidth.button : 0,
                     shadow: primary ? Tokens.Sticker.Shadow.button : Tokens.Sticker.Shadow.secondaryButton)
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

extension ButtonStyle where Self == StickerButtonStyle {
    static func sticker(_ kind: StickerButtonStyle.Kind) -> StickerButtonStyle { StickerButtonStyle(kind: kind) }
}
