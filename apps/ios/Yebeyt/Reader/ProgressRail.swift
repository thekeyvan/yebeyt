import SwiftUI

/// The progress rail on the left edge: one bar per couplet, the ones read in lapis and the current one longer,
/// with «۲ از ۹» under it. A long poem gets one thin track instead of a bar for each couplet.
struct ProgressRail: View {
    let index: Int
    let count: Int
    let theme: ReaderTheme

    private static let mostBars = 14

    var body: some View {
        VStack(spacing: 5) {
            if count <= Self.mostBars {
                ForEach(0..<count, id: \.self) { bar in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(bar <= index ? Tokens.Colors.lapis : theme.track)
                        .frame(width: 5, height: bar == index ? 22 : 12)
                }
            } else {
                Capsule().fill(theme.track).frame(width: 5, height: 200)
                    .overlay(alignment: .top) {
                        Capsule().fill(Tokens.Colors.lapis)
                            .frame(width: 5, height: 200 * CGFloat(index + 1) / CGFloat(count))
                    }
            }
            Text(ReaderText.progress(index: index, count: count))
                .font(.ui(11, weight: .bold, scaled: false))
                .foregroundStyle(theme.secondary)
                .padding(.top, 4)
                .fixedSize()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(ReaderText.progressLabel(index: index, count: count))
        .accessibilityAddTraits(.updatesFrequently)
    }
}
