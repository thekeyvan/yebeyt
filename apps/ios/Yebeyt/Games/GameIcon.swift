import SwiftUI

/// A game's sticker: a coloured circle with a white border and the game's glyph. The glyphs keep the SVG
/// paths of `design/canvas/gameicons.py` (24×24 box); the colours are the game's own.
struct GameIcon: View {
    let kind: GameKind
    var size: CGFloat = 50

    var body: some View {
        let border = max(2, (size / 12).rounded())
        let (first, second) = kind.background
        ZStack {
            Circle().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.2), radius: max(4, size / 8) / 2, x: 0, y: 2)
            Circle().fill(fill(first, second)).padding(border)
            GameGlyph(parts: GameGlyph.parts(for: kind))
                .frame(width: size * 0.56, height: size * 0.56)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    /// Two colours are split on the diagonal, as in the boards' CSS `linear-gradient(135deg, a 50%, b 50%)`.
    private func fill(_ first: Color, _ second: Color?) -> LinearGradient {
        LinearGradient(
            stops: [.init(color: first, location: 0), .init(color: first, location: 0.5), .init(color: second ?? first, location: 0.5), .init(color: second ?? first, location: 1)],
            startPoint: UnitPoint(x: 0, y: 0), endPoint: UnitPoint(x: 1, y: 1)
        )
    }
}

/// The shapes of one glyph, drawn in the 24×24 box.
struct GameGlyph: View {
    struct Part {
        enum Shape {
            case path(String)
            case rect(x: Double, y: Double, width: Double, height: Double, radius: Double)
            case circle(x: Double, y: Double, radius: Double)
        }

        var shape: Shape
        var fill: Color?
        var stroke: Color?
        var width = 2.1
        var dash: [Double] = []
        var opacity = 1.0
        /// Degrees about a point of the box, as the SVG's `rotate(a x y)`.
        var rotation: (degrees: Double, x: Double, y: Double)?
    }

    let parts: [Part]

    var body: some View {
        Canvas { context, canvas in
            let scale = canvas.width / 24
            for part in parts {
                var path = path(for: part.shape)
                if let turn = part.rotation {
                    let about = CGAffineTransform(translationX: -turn.x, y: -turn.y)
                        .concatenating(CGAffineTransform(rotationAngle: turn.degrees * .pi / 180))
                        .concatenating(CGAffineTransform(translationX: turn.x, y: turn.y))
                    path = path.applying(about)
                }
                path = path.applying(CGAffineTransform(scaleX: scale, y: scale))
                if let fill = part.fill { context.fill(path, with: .color(fill.opacity(part.opacity))) }
                if let stroke = part.stroke {
                    let style = StrokeStyle(lineWidth: part.width * scale, lineCap: .round, lineJoin: .round, dash: part.dash.map { $0 * scale })
                    context.stroke(path, with: .color(stroke.opacity(part.opacity)), style: style)
                }
            }
        }
    }

    private func path(for shape: Part.Shape) -> Path {
        switch shape {
        case .path(let d): SVGPathParser.path(d)
        case .rect(let x, let y, let width, let height, let radius):
            Path(roundedRect: CGRect(x: x, y: y, width: width, height: height), cornerRadius: radius)
        case .circle(let x, let y, let radius):
            Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
        }
    }
}
