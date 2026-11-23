import SwiftUI

/// The face drawn as shapes, from the SVG of the `Avatar` board (a 200×200 box, clipped to a circle). The parts
/// choose colours and variants; the accessory is drawn behind the body (the ney, the rose, the candle) or on the head.
struct AvatarView: View {
    let parts: AvatarParts

    var body: some View {
        Canvas { context, size in
            AvatarArt.draw(parts, in: context, scale: size.width / 200)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

/// An accessory as the grid shows it: the board's 44×44 icon.
struct AccessoryIcon: View {
    let accessory: Accessory
    var size: CGFloat = 44

    var body: some View {
        Canvas { context, canvas in
            AvatarArt.drawIcon(accessory, in: context, scale: canvas.width / 44)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

enum AvatarArt {
    private static let ink = Tokens.Colors.ink
    private static let white = Tokens.Colors.white

    /// A small set of SVG-like drawing calls on a context.
    private struct Pen {
        let context: GraphicsContext

        func fill(_ d: String, _ color: Color, opacity: Double = 1) {
            context.fill(SVGPathParser.path(d), with: .color(color.opacity(opacity)))
        }

        func stroke(_ d: String, _ color: Color, width: CGFloat) {
            context.stroke(SVGPathParser.path(d), with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
        }

        func circle(_ x: CGFloat, _ y: CGFloat, _ radius: CGFloat, _ color: Color, opacity: Double = 1) {
            context.fill(Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)), with: .color(color.opacity(opacity)))
        }

        func ellipse(_ x: CGFloat, _ y: CGFloat, _ rx: CGFloat, _ ry: CGFloat, _ color: Color) {
            context.fill(Path(ellipseIn: CGRect(x: x - rx, y: y - ry, width: rx * 2, height: ry * 2)), with: .color(color))
        }

        func rect(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat, radius: CGFloat, _ color: Color, stroke: (Color, CGFloat)? = nil) {
            let path = Path(roundedRect: CGRect(x: x, y: y, width: width, height: height), cornerRadius: radius)
            context.fill(path, with: .color(color))
            if let stroke { context.stroke(path, with: .color(stroke.0), lineWidth: stroke.1) }
        }

        /// SVG's `transform="rotate(angle cx cy)"`.
        func rotated(_ degrees: Double, around x: CGFloat, _ y: CGFloat) -> Pen {
            var turned = context
            turned.translateBy(x: x, y: y)
            turned.rotate(by: .degrees(degrees))
            turned.translateBy(x: -x, y: -y)
            return Pen(context: turned)
        }

        /// SVG's `transform="translate(x y) scale(factor)"`.
        func placed(x: CGFloat, y: CGFloat, scale factor: CGFloat) -> Pen {
            var moved = context
            moved.translateBy(x: x, y: y)
            moved.scaleBy(x: factor, y: factor)
            return Pen(context: moved)
        }
    }

    static func draw(_ parts: AvatarParts, in context: GraphicsContext, scale: CGFloat) {
        var context = context
        context.scaleBy(x: scale, y: scale)
        context.clip(to: Path(ellipseIn: CGRect(x: 4, y: 4, width: 192, height: 192)))
        let pen = Pen(context: context)
        let skin = Color(hex: AvatarCatalogue.skin(parts.face))
        let hair = Color(hex: AvatarCatalogue.hair(parts.hair))
        let accessory = Accessory(rawValue: parts.accessory) ?? .none

        pen.rect(0, 0, 200, 200, radius: 0, Color(hex: AvatarCatalogue.background(parts.background)))
        pen.fill("M0 150 C40 130 70 150 110 138 C150 126 175 142 200 132 L200 200 L0 200Z", Color(hex: 0x9BE275))
        pen.fill("M18 58c8-10 20-8 22 2-10 4-18 4-22-2z", Tokens.Colors.green)
        pen.fill("M166 40c8-8 18-4 18 4-8 4-14 3-18-4z", Tokens.Colors.green)
        drawBehindBody(accessory, pen)
        pen.fill("M44 210 C48 170 76 158 100 158 C124 158 152 170 156 210Z", Tokens.Colors.lapis)
        pen.fill("M86 158 L100 176 L114 158Z", white)
        pen.circle(100, 108, 52, skin)
        pen.fill("M47 104 C46 62 76 48 100 48 C126 48 154 62 153 104 C144 86 126 78 112 80 C104 72 90 70 80 74 C68 78 54 88 47 104Z", hair)
        pen.stroke("M74 98 q8 -5 16 0", hair, width: 4)
        pen.stroke("M110 98 q8 -5 16 0", hair, width: 4)
        drawEyes(parts.eyes, pen)
        pen.circle(70, 128, 7, Color(hex: 0xFF8FB5), opacity: 0.55)
        pen.circle(130, 128, 7, Color(hex: 0xFF8FB5), opacity: 0.55)
        drawMouth(parts.mouth, pen)
        drawOnHead(accessory, pen)
    }

    private static func drawEyes(_ id: String, _ pen: Pen) {
        func round(_ x: CGFloat) {
            pen.ellipse(x, 112, 5.5, 6.5, ink)
            pen.circle(x + 2, 110, 1.8, white)
        }
        func happy(_ d: String) { pen.stroke(d, ink, width: 4) }
        switch id {
        case "happy":
            happy("M74 114 q8 -9 16 0")
            happy("M110 114 q8 -9 16 0")
        case "wink":
            round(82)
            happy("M110 114 q8 -9 16 0")
        default:
            round(82)
            round(118)
        }
    }

    private static func drawMouth(_ id: String, _ pen: Pen) {
        switch id {
        case "grin":
            pen.fill("M84 130 Q100 156 116 130Z", ink)
            pen.fill("M92 141 Q100 148 108 141 Q100 138 92 141Z", Color(hex: 0xFF8FB5))
        case "calm":
            pen.stroke("M90 138 Q100 142 110 138", ink, width: 4)
        default:
            pen.stroke("M88 134 Q100 146 112 134", ink, width: 4)
        }
    }

    /// What is held or stands behind the shoulders.
    private static func drawBehindBody(_ accessory: Accessory, _ pen: Pen) {
        switch accessory {
        case .ney:
            let ney = pen.rotated(24, around: 150, 96)
            ney.rect(145, 28, 11, 120, radius: 5.5, Color(hex: 0xD9A86C))
            for y in [CGFloat(60), 72, 84] { ney.circle(150.5, y, 2.2, Color(hex: 0x7A5230)) }
            ney.rect(145, 28, 11, 8, radius: 3, Color(hex: 0xB98448))
        case .rose:
            pen.stroke("M152 96 L152 176", Color(hex: 0x4C9A22), width: 5)
            pen.fill("M152 140 C140 138 134 130 134 130 C145 128 152 134 152 140Z", Tokens.Colors.green)
            pen.circle(152, 74, 22, Tokens.Colors.magenta)
            pen.stroke("M139 74 a13 13 0 0 1 26 0", Color(hex: 0xC21E62), width: 4)
            pen.circle(152, 74, 6.5, Color(hex: 0xC21E62))
        case .candle:
            icon(.candle, pen.placed(x: 84, y: 42, scale: 3))
        default:
            break
        }
    }

    private static func drawOnHead(_ accessory: Accessory, _ pen: Pen) {
        switch accessory {
        case .crown: icon(.crown, pen.placed(x: 47, y: -24, scale: 2.4))
        case .helmet: icon(.helmet, pen.placed(x: 29.6, y: -21, scale: 3.2))
        default: break
        }
    }

    // MARK: The grid's icons (44×44)

    static func drawIcon(_ accessory: Accessory, in context: GraphicsContext, scale: CGFloat) {
        var context = context
        context.scaleBy(x: scale, y: scale)
        icon(accessory, Pen(context: context))
    }

    private static func icon(_ accessory: Accessory, _ pen: Pen) {
        switch accessory {
        case .none:
            pen.context.stroke(Path(ellipseIn: CGRect(x: 8, y: 8, width: 28, height: 28)), with: .color(Color(hex: 0xB9B4C6)), lineWidth: 3)
            pen.stroke("M12 32L32 12", Color(hex: 0xB9B4C6), width: 3)
        case .ney:
            let ney = pen.rotated(35, around: 22, 22)
            ney.rect(18, 2, 8, 40, radius: 4, Color(hex: 0xD9A86C))
            for y in [CGFloat(14), 21, 28] { ney.circle(22, y, 1.6, Color(hex: 0x7A5230)) }
        case .rose:
            pen.stroke("M22 26v14", Color(hex: 0x4C9A22), width: 3)
            pen.fill("M22 34c-6-1-9-5-9-5 5-1 9 2 9 5z", Tokens.Colors.green)
            pen.circle(22, 17, 10, Tokens.Colors.magenta)
            pen.stroke("M16 17a6 6 0 0 1 12 0", Color(hex: 0xC21E62), width: 2.2)
            pen.circle(22, 17, 3, Color(hex: 0xC21E62))
        case .crown:
            let crown = SVGPathParser.path("M7 32L9 14l7 8 6-12 6 12 7-8 2 18z")
            pen.context.fill(crown, with: .color(Tokens.Colors.amber))
            pen.context.stroke(crown, with: .color(Color(hex: 0xC98A00)), style: StrokeStyle(lineWidth: 2, lineJoin: .round))
            pen.rect(7, 31, 30, 5, radius: 2, Color(hex: 0xC98A00))
            pen.circle(22, 25, 2.5, Tokens.Colors.fire)
        case .helmet:
            pen.stroke("M22 4v6", Color(hex: 0x6E7488), width: 3)
            pen.fill("M8 30a14 14 0 0 1 28 0z", Color(hex: 0x9AA0B4))
            pen.rect(6, 29, 32, 5, radius: 2.5, Color(hex: 0x6E7488))
            pen.stroke("M22 30v8", Color(hex: 0x6E7488), width: 3)
        case .candle:
            pen.rect(17, 20, 10, 20, radius: 3, white, stroke: (Color(hex: 0xDAD6E2), 2))
            pen.fill("M22 8c3 4 3 7 0 10-3-3-3-6 0-10z", Tokens.Colors.amber)
            pen.fill("M33 12c3-3 7-2 7 1s-4 3-7 0zM33 12c-1 4 1 7 3 6s1-5-3-6z", Tokens.Colors.fire)
        }
    }
}
