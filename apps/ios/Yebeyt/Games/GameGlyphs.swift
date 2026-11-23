import SwiftUI

/// The nine glyphs, translated from `_glyph` in design/canvas/gameicons.py. `fg` is the glyph colour, `ac` the
/// accent, `edge` the sticker's own colour (used where a glyph cuts into itself).
extension GameGlyph {
    static func parts(for kind: GameKind) -> [Part] {
        let white = Tokens.Colors.white, ink = Tokens.Colors.ink, lapis = Tokens.Colors.lapis, amber = Tokens.Colors.amber
        let edge = kind.background.0
        func line(_ d: String, _ color: Color, _ width: Double = 2.1, dash: [Double] = []) -> Part {
            Part(shape: .path(d), stroke: color, width: width, dash: dash)
        }
        switch kind {
        case .daily:
            return [
                Part(shape: .rect(x: 4, y: 5.5, width: 16, height: 14.5, radius: 3), stroke: white),
                line("M8.5 3.5v4M15.5 3.5v4", white),
                Part(shape: .rect(x: 7, y: 11.2, width: 4.4, height: 5.6, radius: 1.2), fill: amber),
                Part(shape: .rect(x: 12.6, y: 11.2, width: 4.4, height: 5.6, radius: 1.2), stroke: white, width: 1.5, dash: [1.6, 1.3]),
            ]
        case .jigsaw:
            return [
                Part(shape: .rect(x: 3.2, y: 6.2, width: 8.6, height: 11.6, radius: 2.3), fill: white, rotation: (-10, 7.5, 12)),
                Part(shape: .path("M5.6 12h3.8"), stroke: edge, width: 1.8, rotation: (-10, 7.5, 12)),
                Part(shape: .rect(x: 12.2, y: 6.7, width: 8.6, height: 11.6, radius: 2.3), fill: amber, rotation: (9, 16.5, 12.5)),
                Part(shape: .path("M14.6 12.5h3.8"), stroke: edge, width: 1.8, rotation: (9, 16.5, 12.5)),
            ]
        case .poet:
            return [
                Part(shape: .circle(x: 10.5, y: 10, radius: 4.1), stroke: ink),
                line("M3.2 21c1.2-4 4-6 7.3-6s6.1 2 7.3 6", ink),
                Part(shape: .circle(x: 18.6, y: 5.6, radius: 4), fill: lapis),
                line("M17.3 4.7a1.4 1.4 0 1 1 2 1.3c-.5.2-.7.5-.7 1", white, 1.4),
                Part(shape: .circle(x: 18.6, y: 8.1, radius: 0.7), fill: white),
            ]
        case .misra:
            return [
                line("M20 7.5H6", ink, 2.6),
                line("M20 13H11", ink, dash: [2.4, 2.6]),
                line("M9 18.5H3.8M6.3 16l-2.5 2.5L6.3 21", white, 2.3),
            ]
        case .book:
            return [
                Part(shape: .path("M3.5 6.8c2.8-1.4 5.6-1.1 8.5.8v12c-2.9-1.9-5.7-2.2-8.5-.8z"), fill: white),
                Part(shape: .path("M20.5 6.8c-2.8-1.4-5.6-1.1-8.5.8v12c2.9-1.9 5.7-2.2 8.5-.8z"), fill: white, opacity: 0.78),
                Part(shape: .circle(x: 12, y: 4.6, radius: 3.4), fill: amber, stroke: edge, width: 1.4),
                line("M11 3.9a1.1 1.1 0 1 1 1.5 1c-.4.2-.5.4-.5.8", ink, 1.2),
                Part(shape: .circle(x: 12, y: 6.6, radius: 0.55), fill: ink),
            ]
        case .match:
            return [
                Part(shape: .rect(x: 13.5, y: 4, width: 7.5, height: 5.2, radius: 2), fill: white),
                Part(shape: .rect(x: 3, y: 14.8, width: 7.5, height: 5.2, radius: 2), fill: white),
                Part(shape: .rect(x: 3, y: 4, width: 7.5, height: 5.2, radius: 2), stroke: white, width: 1.6, opacity: 0.6),
                Part(shape: .rect(x: 13.5, y: 14.8, width: 7.5, height: 5.2, radius: 2), stroke: white, width: 1.6, opacity: 0.6),
                line("M13.5 6.6c-4 0-0.5 10.8-3 10.8", Tokens.Colors.green, 2.3),
            ]
        case .listen:
            return [
                line("M4.2 15v-3a7.8 7.8 0 0 1 15.6 0v3", white),
                Part(shape: .rect(x: 3, y: 14, width: 4.6, height: 6.6, radius: 1.9), fill: white),
                Part(shape: .rect(x: 16.4, y: 14, width: 4.6, height: 6.6, radius: 1.9), fill: white),
                line("M8.6 17.2c.9-2.2 1.8 2.2 2.7 0s1.8 2.2 2.7 0 1.8 2.2 2.7 0", Tokens.Colors.magenta, 1.9),
            ]
        case .mosh:
            return [
                Part(shape: .path("M4 4.5h9.5a2 2 0 0 1 2 2v4.3a2 2 0 0 1-2 2H8.3l-3.1 2.7v-2.7H4a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"), fill: ink),
                Part(shape: .path("M11 11.6h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.6v2.7l-3.1-2.7H11a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"), fill: white, stroke: ink, width: 1.2),
                line("M13.2 15.6h5", lapis, 1.8),
                line("M6 8.6h5", edge, 1.8),
            ]
        case .duel:
            return [
                Part(shape: .circle(x: 5.8, y: 9.4, radius: 2.8), fill: white),
                Part(shape: .path("M1.8 19.5c.6-3 2.1-4.6 4-4.6s3.4 1.6 4 4.6z"), fill: white),
                Part(shape: .circle(x: 18.2, y: 9.4, radius: 2.8), fill: white),
                Part(shape: .path("M14.2 19.5c.6-3 2.1-4.6 4-4.6s3.4 1.6 4 4.6z"), fill: white),
                Part(shape: .path("M13.2 2.8L9.4 11.2h3.1l-1.2 7 4.4-9.4h-3.2z"), fill: amber, stroke: ink, width: 1.1),
            ]
        }
    }
}
