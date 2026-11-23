import SwiftUI

/// A book cover, drawn as in the SVG of the Explore, Library and Book boards (112×158): pages at the
/// edge, the cover with its spine shade and highlight, the ornament, the ribbon and the shadow below.
/// Never mirrored: the spine stays at the right.
struct BookCover: View {
    let color: PaletteColor

    var body: some View {
        Canvas { context, size in
            let scale = size.width / 112
            context.scaleBy(x: scale, y: scale)
            draw(&context)
        }
        .aspectRatio(112 / 158, contentMode: .fit)
        .accessibilityHidden(true)
    }

    private func draw(_ context: inout GraphicsContext) {
        context.fill(Path(ellipseIn: CGRect(x: 8, y: 146, width: 100, height: 10)), with: .color(Tokens.Colors.ink.opacity(0.16)))
        pages(&context)
        let cover = CGRect(x: 12, y: 3, width: 98, height: 146)
        context.fill(Path(roundedRect: cover, cornerRadius: 4), with: .color(color.color))
        context.fill(Path(roundedRect: CGRect(x: 94, y: 3, width: 16, height: 146), cornerRadius: 4), with: .color(.black.opacity(0.2)))
        context.fill(Path(CGRect(x: 91, y: 3, width: 1.6, height: 146)), with: .color(.white.opacity(0.35)))
        var ornament = Path()
        ornament.move(to: CGPoint(x: 52, y: 56))
        ornament.addCurve(to: CGPoint(x: 52, y: 96), control1: CGPoint(x: 64, y: 66), control2: CGPoint(x: 64, y: 86))
        ornament.addCurve(to: CGPoint(x: 52, y: 56), control1: CGPoint(x: 40, y: 86), control2: CGPoint(x: 40, y: 66))
        context.stroke(ornament, with: .color(.white.opacity(0.55)), lineWidth: 2.4)
        var ribbon = Path()
        ribbon.move(to: CGPoint(x: 30, y: 140))
        ribbon.addLine(to: CGPoint(x: 30, y: 156))
        ribbon.addLine(to: CGPoint(x: 35, y: 152))
        ribbon.addLine(to: CGPoint(x: 40, y: 156))
        ribbon.addLine(to: CGPoint(x: 40, y: 140))
        ribbon.closeSubpath()
        context.fill(ribbon, with: .color(color.ribbon.color))
    }

    /// The page block: a slanted strip of cream with a fine line every 3 units.
    private func pages(_ context: inout GraphicsContext) {
        var block = Path()
        block.move(to: CGPoint(x: 2, y: 12))
        block.addLine(to: CGPoint(x: 14, y: 5))
        block.addLine(to: CGPoint(x: 14, y: 147))
        block.addLine(to: CGPoint(x: 2, y: 141))
        block.closeSubpath()
        context.fill(block, with: .color(Color(hex: 0xFBF8F1)))
        context.drawLayer { layer in
            layer.clip(to: block)
            for x in stride(from: 2.0, through: 11.0, by: 3.0) {
                layer.fill(Path(CGRect(x: x, y: 0, width: 1, height: 158)), with: .color(Color(hex: 0xE2DCCF)))
            }
        }
    }
}
