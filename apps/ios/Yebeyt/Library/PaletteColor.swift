import SwiftUI

/// The six colours of curation.json (poets, book covers), by the names of the design tokens.
enum PaletteColor: String, Decodable, CaseIterable, Sendable {
    case lapis, fire, amber, green, magenta, ink

    /// A book cover's colour: the token itself.
    var color: Color {
        switch self {
        case .lapis: Tokens.Colors.lapis
        case .fire: Tokens.Colors.fire
        case .amber: Tokens.Colors.amber
        case .green: Tokens.Colors.green
        case .magenta: Tokens.Colors.magenta
        case .ink: Tokens.Colors.ink
        }
    }

    /// The ribbon on a cover, as in the Library board: lapis→magenta, fire→amber, green→lapis, amber→lapis,
    /// magenta→amber, ink→fire.
    var ribbon: PaletteColor {
        switch self {
        case .lapis: .magenta
        case .fire, .magenta: .amber
        case .green, .amber: .lapis
        case .ink: .fire
        }
    }

    /// A poet's circle: the deeper shades of the Explore board (the amber is ours: the board has no amber poet).
    var poetCircle: Color {
        switch self {
        case .lapis: Tokens.Colors.lapis
        case .fire: Color(hex: 0xE8431C)
        case .amber: Color(hex: 0xE09A00)
        case .green: Color(hex: 0x3E9A1E)
        case .magenta: Color(hex: 0xE0307A)
        case .ink: Tokens.Colors.ink
        }
    }

    /// The circle on the poet's own card, a shade darker than the card (the Poet board: #1C20B8 on lapis).
    var poetCardCircle: Color {
        let (red, green, blue) = poetCircle.components
        return Color(.sRGB, red: red * 0.75, green: green * 0.75, blue: blue * 0.75)
    }

    /// Text on a card of this colour: white, but ink on amber (as on the games cards).
    var onColor: Color {
        self == .amber ? Tokens.Colors.ink : Tokens.Colors.white
    }
}

private extension Color {
    var components: (Double, Double, Double) {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        UIColor(self).getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return (red, green, blue)
    }
}
