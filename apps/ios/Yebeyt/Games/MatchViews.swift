import SwiftUI

/// The couplet of معنی‌یاب, the hard words with a dotted underline.
struct MatchCoupletCard: View {
    let question: MatchQuestion

    var body: some View {
        VStack(spacing: 4) {
            line(question.lines[0]).frame(maxWidth: .infinity, alignment: .leading)
            line(question.lines[1]).frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, 18).padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 5, x: 0, y: 3)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("matchCouplet")
    }

    private func line(_ tokens: [MatchToken]) -> some View {
        var text = AttributedString()
        for (index, token) in tokens.enumerated() {
            var piece = AttributedString(TextNormalizer.plain(token.text))
            if token.glossed { piece.underlineStyle = Text.LineStyle(pattern: .dot, color: Tokens.Colors.lapis) }
            text += piece
            if index < tokens.count - 1 { text += AttributedString(" ") }
        }
        return Text(text).font(.poem(17)).lineSpacing(8).foregroundStyle(Tokens.Colors.ink).multilineTextAlignment(.leading)
    }
}

/// Words on one side (about two fifths), meanings on the other, each pair of cards in one row. SwiftUI mirrors it in
/// right-to-left, so the words are at the right.
private struct TwoColumnRow: Layout {
    var spacing: CGFloat = 40

    private func widths(_ total: CGFloat) -> (CGFloat, CGFloat) {
        let free = max(total - spacing, 0)
        return (free / 2.5, free / 2.5 * 1.5)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 300
        let (first, second) = widths(width)
        let height = max(
            subviews[0].sizeThatFits(ProposedViewSize(width: first, height: nil)).height,
            subviews[1].sizeThatFits(ProposedViewSize(width: second, height: nil)).height
        )
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (first, second) = widths(bounds.width)
        subviews[0].place(at: bounds.origin, proposal: ProposedViewSize(width: first, height: bounds.height))
        subviews[1].place(at: CGPoint(x: bounds.minX + first + spacing, y: bounds.minY), proposal: ProposedViewSize(width: second, height: bounds.height))
    }
}

/// Where the cards are, in the board's own space, so the curves can join them: `w<id>` for a word, `m<id>` for a meaning.
private struct CardFrames: PreferenceKey {
    static let defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue()) { $1 }
    }
}

private extension View {
    func reportFrame(_ key: String, in space: String) -> some View {
        background(GeometryReader { proxy in Color.clear.preference(key: CardFrames.self, value: [key: proxy.frame(in: .named(space))]) })
    }
}

/// The two columns of cards with the green curves behind them.
struct MatchBoard: View {
    let round: MatchRound
    let shakes: [Int: Int]
    /// The meaning tapped wrong a moment ago, in red.
    let wrongMeaning: Int?
    let selectWord: (Int) -> Void
    let pick: (Int) -> Void

    private static let space = "matchBoard"

    var body: some View {
        let question = round.current
        VStack(spacing: 10) {
            ForEach(Array(question.words.enumerated()), id: \.offset) { row, word in
                let meaning = question.words[question.meanings[row]]
                TwoColumnRow {
                    wordCard(word).reportFrame("w\(word.id)", in: Self.space)
                    meaningCard(meaning).reportFrame("m\(meaning.id)", in: Self.space)
                }
            }
        }
        .coordinateSpace(name: Self.space)
        .backgroundPreferenceValue(CardFrames.self) { frames in curves(frames) }
        // Not on a question's last pair: the answer sheet's tap follows it.
        .sensoryFeedback(.success, trigger: round.matched.count) { old, new in new > old && new < round.current.words.count }
        .sensoryFeedback(.error, trigger: shakes.values.reduce(0, +))
    }

    private func wordCard(_ word: MatchWord) -> some View {
        let matched = round.matched.contains(word.id), selected = round.selectedWord == word.id
        return Button { selectWord(word.id) } label: {
            Text(word.text).font(.poem(18)).multilineTextAlignment(.center)
                .foregroundStyle(matched ? Color(hex: 0x3E9A1E) : selected ? Tokens.Colors.white : Tokens.Colors.ink)
                .frame(maxWidth: .infinity, minHeight: 48, maxHeight: .infinity)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 16).fill(matched ? Color(hex: 0xEEF9E7) : selected ? Tokens.Colors.lapis : Tokens.Colors.white))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(matched ? Tokens.Colors.green : Tokens.Colors.white, lineWidth: 3))
                .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 4, x: 0, y: 2)
                .popWhen(matched, wiggle: true)
        }
        .buttonStyle(.press)
        .allowsHitTesting(!matched)
        .accessibilityLabel(word.text)
        .accessibilityIdentifier("word-\(word.id)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func meaningCard(_ word: MatchWord) -> some View {
        let matched = round.matched.contains(word.id), wrong = wrongMeaning == word.id
        return Button { pick(word.id) } label: {
            Text(word.gloss).font(.ui(13, weight: .medium)).multilineTextAlignment(.center)
                .foregroundStyle(matched ? Color(hex: 0x3E9A1E) : Tokens.Colors.ink)
                .frame(maxWidth: .infinity, minHeight: 48, maxHeight: .infinity)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 16).fill(matched ? Color(hex: 0xEEF9E7) : wrong ? Tokens.Colors.fireTint : Tokens.Colors.white))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(matched ? Tokens.Colors.green : wrong ? Tokens.Colors.fire : Tokens.Colors.white, lineWidth: 3))
                .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 4, x: 0, y: 2)
                .shake(shakes[word.id] ?? 0)
                .popWhen(matched, wiggle: true)
        }
        .buttonStyle(.press)
        .allowsHitTesting(!matched)
        .accessibilityLabel(word.gloss)
        .accessibilityValue(matched ? "درست" : wrong ? "نشد" : "")
        .accessibilityIdentifier("meaning-\(word.id)")
    }

    /// From the left edge of a word's card to the right edge of its meaning's card, as the board's SVG draws it.
    private func curves(_ frames: [String: CGRect]) -> some View {
        let joins = round.matched.sorted().compactMap { id -> (CGPoint, CGPoint)? in
            guard let word = frames["w\(id)"], let meaning = frames["m\(id)"] else { return nil }
            return (CGPoint(x: word.minX, y: word.midY), CGPoint(x: meaning.maxX, y: meaning.midY))
        }
        return CurveShape(joins: joins)
            .stroke(Tokens.Colors.green, style: StrokeStyle(lineWidth: 3, lineCap: .round))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// Curves from a start to an end point, in the board's own coordinates; never mirrored.
private struct CurveShape: Shape {
    let joins: [(CGPoint, CGPoint)]

    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        Path { path in
            for (start, end) in joins {
                let reach = (start.x - end.x) * 0.55
                path.move(to: start)
                path.addCurve(to: end, control1: CGPoint(x: start.x - reach, y: start.y), control2: CGPoint(x: end.x + reach, y: end.y))
            }
        }
    }
}
