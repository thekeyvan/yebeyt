import SwiftUI
import UIKit

/// A hemistich line drawn the way the boards do: the CSS `line-height` is a multiple of the font size,
/// and Parastoo's glyphs are scaled to 84% inside that box.
private struct PoemLine: ViewModifier {
    let settings: TextSettings
    let size: CGFloat
    let factor: CGFloat

    func body(content: Content) -> some View {
        let glyphSize = size * settings.glyphScale
        let natural = UIFont(name: settings.postScript, size: glyphSize)?.lineHeight ?? glyphSize * 1.5
        let extra = size * factor - natural
        content
            .font(.custom(settings.postScript, fixedSize: glyphSize))
            .lineSpacing(extra)
            .padding(.vertical, extra / 2)
    }
}

extension View {
    /// `size` is the board's font size and `factor` its line height as a multiple of it.
    func poemLine(_ settings: TextSettings, size: CGFloat, factor: CGFloat) -> some View {
        modifier(PoemLine(settings: settings, size: size, factor: factor))
    }
}

/// One couplet's two hemistichs, staggered (the first at the start, the second at the end) or centred.
struct CoupletText: View {
    let couplet: Couplet
    let settings: TextSettings
    let size: CGFloat
    let factor: CGFloat
    var color: Color

    var body: some View {
        let staggered = settings.layout == .staggered
        VStack(spacing: 0) {
            line(couplet.m1, frame: staggered ? .leading : .center, text: staggered ? .leading : .center)
            if !couplet.m2.isEmpty {
                line(couplet.m2, frame: staggered ? .trailing : .center, text: staggered ? .trailing : .center)
            }
        }
        .foregroundStyle(color)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(couplet.m2.isEmpty ? couplet.m1 : "\(couplet.m1)، \(couplet.m2)")
    }

    private func line(_ text: String, frame: Alignment, text textAlignment: TextAlignment) -> some View {
        Text(text)
            .multilineTextAlignment(textAlignment)
            .poemLine(settings, size: size, factor: factor)
            .frame(maxWidth: .infinity, alignment: frame)
    }
}

extension TextSettings {
    /// The whole-poem list is a little smaller and tighter than the couplet page (20 / 1.9 against 21 / 2.1).
    var listSize: CGFloat { CGFloat(size - 1) }
    var listFactor: CGFloat { spacing.factor - 0.2 }
}
