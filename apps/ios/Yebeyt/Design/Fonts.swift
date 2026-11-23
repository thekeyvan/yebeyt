import SwiftUI

/// The four role fonts. Sizes are the board sizes: the poem fonts are scaled by their `sizeAdjust`,
/// as the boards do. Pass `scaled: false` for fixed-size chrome such as the tab bar.
extension Font {
    static func title(_ size: CGFloat, scaled: Bool = true) -> Font {
        role(Tokens.Fonts.title, size, scaled)
    }

    static func ui(_ size: CGFloat, weight: Font.Weight = .regular, scaled: Bool = true) -> Font {
        role(Tokens.Fonts.ui, size, scaled).weight(weight)
    }

    static func poem(_ size: CGFloat, scaled: Bool = true) -> Font {
        role(Tokens.Fonts.poem, size, scaled)
    }

    static func poemRegular(_ size: CGFloat, scaled: Bool = true) -> Font {
        role(Tokens.Fonts.poemRegular, size, scaled)
    }

    private static func role(_ token: FontToken, _ size: CGFloat, _ scaled: Bool) -> Font {
        let adjusted = size * token.sizeAdjust
        return scaled ? .custom(token.postScript, size: adjusted) : .custom(token.postScript, fixedSize: adjusted)
    }
}
