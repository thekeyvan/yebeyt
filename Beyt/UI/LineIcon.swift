import SwiftUI

/// The app's own hand-drawn line icons (same set as the design prototype).
struct LineIcon: View {
    let name: String
    var size: CGFloat = 22
    var filled = false
    var lineWidth: CGFloat = 1.8

    var body: some View {
        let d = IconData.icons[name] ?? ""
        let shape = SVGShape(d: d, box: 24)
        Group {
            if filled || name == "play" || name == "pause" {
                shape.fill(style: FillStyle(eoFill: false))
            } else {
                shape.stroke(style: StrokeStyle(lineWidth: lineWidth * size / 24, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: size, height: size)
        .environment(\.layoutDirection, .leftToRight) // drawn for RTL already; don't mirror
        .accessibilityHidden(true)
    }
}

/// A poet emblem or scene motif (48×48 line drawings).
struct Emblem: View {
    let d: String
    var size: CGFloat = 26
    var lineWidth: CGFloat = 2
    var body: some View {
        SVGShape(d: d, box: 48)
            .stroke(style: StrokeStyle(lineWidth: lineWidth * size / 48, lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
            .environment(\.layoutDirection, .leftToRight)
            .accessibilityHidden(true)
    }
}

/// Parses an SVG path `d` string (M L H V C S Q T A Z, absolute and relative) into a Shape.
struct SVGShape: Shape {
    let d: String
    let box: CGFloat

    func path(in rect: CGRect) -> Path {
        let p = SVGShape.parse(d)
        let s = min(rect.width, rect.height) / box
        return p.applying(CGAffineTransform(scaleX: s, y: s).concatenating(CGAffineTransform(translationX: rect.minX, y: rect.minY)))
    }

    private static var cache: [String: Path] = [:]

    static func parse(_ d: String) -> Path {
        if let c = cache[d] { return c }
        var path = Path()
        var tokens: [Character] = Array(d)
        var i = 0
        var cmd: Character = "M"
        var cur = CGPoint.zero, start = CGPoint.zero, lastCtrl: CGPoint? = nil, lastQuad: CGPoint? = nil

        func skip() { while i < tokens.count, tokens[i] == " " || tokens[i] == "," || tokens[i] == "\n" { i += 1 } }
        func isNumStart() -> Bool { skip(); guard i < tokens.count else { return false }; let c = tokens[i]; return c.isNumber || c == "-" || c == "." || c == "+" }
        func number() -> CGFloat {
            skip()
            var s = "", seenDot = false, seenExp = false
            if i < tokens.count, tokens[i] == "-" || tokens[i] == "+" { s.append(tokens[i]); i += 1 }
            while i < tokens.count {
                let c = tokens[i]
                if c.isNumber { s.append(c) }
                else if c == ".", !seenDot, !seenExp { seenDot = true; s.append(c) }
                else if (c == "e" || c == "E"), !seenExp { seenExp = true; s.append(c); if i + 1 < tokens.count, tokens[i + 1] == "-" { i += 1; s.append("-") } }
                else { break }
                i += 1
            }
            return CGFloat(Double(s) ?? 0)
        }
        func flag() -> Bool { skip(); let c = tokens[i]; i += 1; return c == "1" }

        while i < tokens.count {
            skip()
            guard i < tokens.count else { break }
            if tokens[i].isLetter { cmd = tokens[i]; i += 1 }
            let rel = cmd.isLowercase
            let o = rel ? cur : .zero
            switch cmd.uppercased() {
            case "M":
                cur = CGPoint(x: o.x + number(), y: o.y + number()); start = cur; path.move(to: cur)
                cmd = rel ? "l" : "L"; lastCtrl = nil; lastQuad = nil
                continue
            case "L":
                cur = CGPoint(x: o.x + number(), y: o.y + number()); path.addLine(to: cur); lastCtrl = nil; lastQuad = nil
            case "H":
                cur = CGPoint(x: (rel ? cur.x : 0) + number(), y: cur.y); path.addLine(to: cur); lastCtrl = nil; lastQuad = nil
            case "V":
                cur = CGPoint(x: cur.x, y: (rel ? cur.y : 0) + number()); path.addLine(to: cur); lastCtrl = nil; lastQuad = nil
            case "C":
                let c1 = CGPoint(x: o.x + number(), y: o.y + number())
                let c2 = CGPoint(x: o.x + number(), y: o.y + number())
                cur = CGPoint(x: o.x + number(), y: o.y + number())
                path.addCurve(to: cur, control1: c1, control2: c2); lastCtrl = c2; lastQuad = nil
            case "S":
                let c1 = lastCtrl.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                let c2 = CGPoint(x: o.x + number(), y: o.y + number())
                cur = CGPoint(x: o.x + number(), y: o.y + number())
                path.addCurve(to: cur, control1: c1, control2: c2); lastCtrl = c2; lastQuad = nil
            case "Q":
                let c = CGPoint(x: o.x + number(), y: o.y + number())
                cur = CGPoint(x: o.x + number(), y: o.y + number())
                path.addQuadCurve(to: cur, control: c); lastQuad = c; lastCtrl = nil
            case "T":
                let c = lastQuad.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                cur = CGPoint(x: o.x + number(), y: o.y + number())
                path.addQuadCurve(to: cur, control: c); lastQuad = c; lastCtrl = nil
            case "A":
                let rx = number(), ry = number(), rot = number(), large = flag(), sweep = flag()
                let end = CGPoint(x: o.x + number(), y: o.y + number())
                addArc(&path, from: cur, to: end, rx: rx, ry: ry, rotation: rot, large: large, sweep: sweep)
                cur = end; lastCtrl = nil; lastQuad = nil
            case "Z":
                path.closeSubpath(); cur = start; lastCtrl = nil; lastQuad = nil
                continue
            default:
                i += 1
                continue
            }
            if !isNumStart() { continue }
        }
        cache[d] = path
        _ = tokens.count
        tokens = []
        return path
    }

    /// SVG endpoint arc → cubic curves.
    private static func addArc(_ path: inout Path, from p0: CGPoint, to p1: CGPoint, rx rx0: CGFloat, ry ry0: CGFloat, rotation: CGFloat, large: Bool, sweep: Bool) {
        if p0 == p1 { return }
        var rx = abs(rx0), ry = abs(ry0)
        if rx == 0 || ry == 0 { path.addLine(to: p1); return }
        let phi = rotation * .pi / 180, cosP = cos(phi), sinP = sin(phi)
        let dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2
        let x1 = cosP * dx + sinP * dy, y1 = -sinP * dx + cosP * dy
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 { rx *= sqrt(lambda); ry *= sqrt(lambda) }
        let num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let den = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var coef = sqrt(max(0, num / den))
        if large == sweep { coef = -coef }
        let cx1 = coef * rx * y1 / ry, cy1 = -coef * ry * x1 / rx
        let cx = cosP * cx1 - sinP * cy1 + (p0.x + p1.x) / 2
        let cy = sinP * cx1 + cosP * cy1 + (p0.y + p1.y) / 2
        func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a
        }
        let theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
        var dTheta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if !sweep && dTheta > 0 { dTheta -= 2 * .pi } else if sweep && dTheta < 0 { dTheta += 2 * .pi }
        let segs = Int(ceil(abs(dTheta) / (.pi / 2)))
        let delta = dTheta / CGFloat(segs)
        let t = 4 / 3 * tan(delta / 4)
        var th = theta1
        for _ in 0..<segs {
            let c1 = CGPoint(x: cos(th) - t * sin(th), y: sin(th) + t * cos(th))
            let th2 = th + delta
            let e = CGPoint(x: cos(th2), y: sin(th2))
            let c2 = CGPoint(x: e.x + t * sin(th2), y: e.y - t * cos(th2))
            func map(_ p: CGPoint) -> CGPoint { CGPoint(x: cx + rx * p.x * cosP - ry * p.y * sinP, y: cy + rx * p.x * sinP + ry * p.y * cosP) }
            path.addCurve(to: map(e), control1: map(c1), control2: map(c2))
            th = th2
        }
    }
}

/// Any icon in the app. Names map to the hand-drawn set; anything unmapped falls back to SF Symbols.
struct AppIcon: View {
    let name: String
    var size: CGFloat = 18
    init(_ name: String, size: CGFloat = 18) { self.name = name; self.size = size }

    static let map: [String: (String, Bool)] = [
        "house": ("home", false), "house.fill": ("home", false), "books.vertical": ("book", false), "books.vertical.fill": ("book", false),
        "person": ("me", false), "person.fill": ("me", false), "magnifyingglass": ("search", false),
        "chevron.backward": ("back", false), "chevron.forward": ("fwd", false), "ellipsis": ("more", false),
        "textformat.size": ("aa", false), "rectangle.stack": ("cards", false), "list.bullet": ("list", false),
        "lightbulb": ("bulb", false), "square.and.arrow.up": ("share", false), "eye": ("eye", false), "eye.fill": ("eye", false),
        "checkmark": ("check", false), "xmark": ("close", false), "book": ("book", false), "folder": ("book", false),
        "headphones": ("head", false), "music.note": ("music", false), "flame": ("flame", false),
        "heart": ("heart", false), "heart.fill": ("heart", true), "doc.on.doc": ("copy", false),
        "play.fill": ("play", true), "pause.fill": ("pause", true), "sparkle": ("ai", false), "sparkles": ("fal", false), "shuffle": ("feed", false),
    ]

    var body: some View {
        if let (n, filled) = AppIcon.map[name] {
            LineIcon(name: n, size: size * 1.3, filled: filled)
        } else {
            Image(systemName: name).font(.system(size: size))
        }
    }
}
