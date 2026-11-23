import SwiftUI

/// The daily puzzle's card on the games tab (GamesE): the couplet with its missing word as empty boxes and
/// «بزن بریم». Once the puzzle is over it shows the couplet complete and the button reads «ببین».
struct DailyPuzzleCard: View {
    let puzzle: DailyPuzzle
    let day: TehranDay
    let finished: Bool
    let open: () -> Void
    @Environment(\.layoutDirection) private var direction

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("معمای امروز · \(PersianDigits.string(DailyGame.maxTries)) فرصت")
                .font(.ui(13, weight: .medium))
                .padding(.horizontal, 12).padding(.vertical, 3)
                .background(Capsule().fill(Tokens.Colors.white.opacity(0.18)))
            Text("کلمه‌ی گم‌شده").font(.title(30)).accessibilityAddTraits(.isHeader)
            couplet
            HStack {
                Spacer(minLength: 0)
                Button(finished ? "ببین" : "بزن بریم", action: open)
                    .buttonStyle(DailyButtonStyle())
                    .accessibilityIdentifier("dailyOpen")
            }
            .padding(.top, 2)
        }
        .foregroundStyle(Tokens.Colors.white)
        .padding(EdgeInsets(top: 18, leading: 18, bottom: 16, trailing: 18))
        .frame(maxWidth: .infinity, alignment: .leading)
        .sticker(fill: Tokens.Colors.lapis, radius: 28, border: 5, shadow: ShadowToken(y: 4, blur: 12, opacity: 0.22))
        .overlay(alignment: .topTrailing) { dateSticker.padding(.trailing, 16).offset(y: -16) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("dailyCard")
    }

    @ViewBuilder private var couplet: some View {
        if finished {
            VStack(alignment: .leading, spacing: 0) {
                Text(puzzle.couplet.m1).font(.poem(21))
                Text(puzzle.couplet.m2).font(.poem(21))
            }
            .accessibilityIdentifier("dailySolved")
        } else {
            let words = puzzle.hemistich.split(whereSeparator: \.isWhitespace).map(String.init)
            WrapLayout(spacing: 8, lineSpacing: 2, rightToLeft: direction == .rightToLeft) {
                ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                    if index == puzzle.wordIndex { boxes } else { Text(word).font(.poem(21)) }
                }
            }
        }
    }

    /// One white box for each letter of the missing word.
    private var boxes: some View {
        HStack(spacing: 5) {
            ForEach(0..<puzzle.letters.count, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 8).fill(Tokens.Colors.white).frame(width: 28, height: 32)
                    .shadow(color: Color(red: 10 / 255, green: 10 / 255, blue: 80 / 255).opacity(0.3), radius: 2, x: 0, y: 2)
            }
        }
        .accessibilityLabel("کلمه‌ی گم‌شده، \(PersianDigits.string(puzzle.letters.count)) حرفی")
    }

    /// «۱» over «آذر», on an amber sticker tilted at the corner.
    private var dateSticker: some View {
        let parts = day.stickerParts
        return VStack(spacing: 0) {
            Text(parts.day).font(.title(22)).padding(.top, 4)
            Text(parts.month).font(.ui(11, weight: .bold))
        }
        .foregroundStyle(Tokens.Colors.ink)
        .frame(width: 56, height: 56)
        .sticker(fill: Tokens.Colors.amber, radius: 32, border: 4, shadow: ShadowToken(y: 3, blur: 8, opacity: 0.25))
        .tilted(12)
        .accessibilityHidden(true)
    }
}

/// «بزن بریم»: amber, Lalezar 19, white border.
private struct DailyButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title(19))
            .foregroundStyle(Tokens.Colors.ink)
            .padding(EdgeInsets(top: 4, leading: 10, bottom: 0, trailing: 10))
            .sticker(fill: Tokens.Colors.amber, radius: 14, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.3))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}
