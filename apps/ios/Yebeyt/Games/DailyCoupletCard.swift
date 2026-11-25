import SwiftUI

/// The couplet of معمای امروز on a lapis card, with the hidden word as a dashed blank until the puzzle is over.
struct DailyCoupletCard: View {
    let puzzle: DailyPuzzle
    /// Shows the word instead of the blank.
    let revealed: Bool
    var density = DailyDensity()

    var body: some View {
        VStack(spacing: 6) {
            line(puzzle.couplet.m1, blank: !puzzle.inSecondHemistich)
                .frame(maxWidth: .infinity, alignment: .leading)
            line(puzzle.couplet.m2, blank: puzzle.inSecondHemistich)
                .frame(maxWidth: .infinity, alignment: .trailing)
            Text("\(puzzle.couplet.poetName) · یه کلمه‌ی \(PersianDigits.string(puzzle.letters.count)) حرفی")
                .font(.ui(12)).foregroundStyle(Color(hex: 0xD6D8FF))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(density.compact ? EdgeInsets(top: 14, leading: 18, bottom: 12, trailing: 18) : EdgeInsets(top: 20, leading: 20, bottom: 18, trailing: 20))
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.lapis)
                .shadow(color: Tokens.Colors.lapis.opacity(0.28), radius: 8, x: 0, y: 6)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("dailyCouplet")
    }

    @ViewBuilder private func line(_ text: String, blank: Bool) -> some View {
        if blank {
            let words = text.split(whereSeparator: \.isWhitespace).map(String.init)
            WrapLayout(spacing: 6, lineSpacing: 0) {
                ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                    if index == puzzle.wordIndex {
                        hidden(word)
                    } else {
                        poemText(word)
                    }
                }
            }
        } else {
            poemText(text)
        }
    }

    @ViewBuilder private func hidden(_ word: String) -> some View {
        if revealed {
            Text(word).font(.poem(20)).foregroundStyle(Tokens.Colors.amber).padding(.bottom, 4)
        } else {
            Rectangle().fill(.clear).frame(width: 64, height: 24)
                .overlay(alignment: .bottom) { DashedRule(color: Tokens.Colors.amber, width: 3) }
                .accessibilityLabel("کلمه‌ی گم‌شده")
        }
    }

    private func poemText(_ text: String) -> some View {
        Text(text).font(.poem(20)).lineSpacing(density.compact ? 4 : 8).foregroundStyle(Tokens.Colors.white)
            .multilineTextAlignment(.leading)
    }
}

/// A dashed horizontal rule, the blank of the missing word.
struct DashedRule: View {
    let color: Color
    let width: CGFloat

    var body: some View {
        Line().stroke(color, style: StrokeStyle(lineWidth: width, dash: [width * 2, width]))
            .frame(height: width)
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            Path { $0.move(to: CGPoint(x: rect.minX, y: rect.midY)); $0.addLine(to: CGPoint(x: rect.maxX, y: rect.midY)) }
        }
    }
}
