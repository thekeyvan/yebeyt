import SwiftUI

/// Paper with dots on a grid, like the sheet behind a sticker. A dot sits in the middle of each grid cell.
struct DottedPaper: View {
    var body: some View {
        Canvas { context, size in
            let grid = Tokens.Sticker.Dots.grid
            let radius = Tokens.Sticker.Dots.radius
            var dots = Path()
            for column in 0..<Int((size.width / grid).rounded(.up)) {
                for row in 0..<Int((size.height / grid).rounded(.up)) {
                    let center = CGPoint(x: (CGFloat(column) + 0.5) * grid, y: (CGFloat(row) + 0.5) * grid)
                    dots.addEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
                }
            }
            context.fill(dots, with: .color(Tokens.Colors.dot))
        }
        .background(Tokens.Colors.paper)
        .accessibilityHidden(true)
    }
}

extension View {
    /// Dotted paper behind the view, over the whole screen.
    func dottedPaper() -> some View {
        background { DottedPaper().ignoresSafeArea() }
    }
}
