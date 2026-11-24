import SwiftUI

/// How an option of a quiz looks: waiting, chosen, or — once the sheet is open — the right one, the wrong one chosen,
/// the others dimmed. ۵۰:۵۰ takes options away (they stay as empty room so nothing jumps).
enum OptionState {
    case idle, selected, right, wrong, dimmed, removed

    var border: Color {
        switch self {
        case .selected: Tokens.Colors.lapis
        case .right: Tokens.Colors.green
        case .wrong: Tokens.Colors.fire
        default: Tokens.Colors.white
        }
    }

    var opacity: Double {
        switch self {
        case .dimmed: 0.45
        case .removed: 0
        default: 1
        }
    }
}

/// The round badge in the corner of the right or wrong option: ✓ on green, × on fire.
private struct VerdictBadge: View {
    let right: Bool

    var body: some View {
        ZStack {
            Circle().fill(right ? Tokens.Colors.green : Tokens.Colors.fire)
            if right {
                LineIcon(shape: CheckIcon(), size: 12, lineWidth: 3.6, fill: nil).foregroundStyle(Tokens.Colors.white)
            } else {
                LineIcon(shape: CloseIcon(), size: 10, lineWidth: 3.6, fill: nil).foregroundStyle(Tokens.Colors.white)
            }
        }
        .frame(width: 24, height: 24)
        .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
        .padding(8)
    }
}

extension View {
    /// The badge of the right (✓) or the wrong chosen option (×), at the physical left.
    @ViewBuilder func verdictBadge(_ state: OptionState) -> some View {
        switch state {
        case .right: overlay(alignment: .topTrailing) { VerdictBadge(right: true) }
        case .wrong: overlay(alignment: .topTrailing) { VerdictBadge(right: false) }
        default: self
        }
    }
}

/// The white card with the couplet: the first hemistich at the start, the second at the end (a dashed blank while
/// it is the question), a poet's tag at the corner and a poet chip at the bottom.
struct QuizCoupletCard: View {
    let couplet: GameCouplet
    var secondShown = true
    /// مصراع دوم: the poet's name on a magenta sticker.
    var tag: String?
    /// The tag's colour: the poet's magenta in the solo games, ink in رودررو.
    var tagColor = Tokens.Colors.magenta
    /// از کدوم کتاب؟: the poet's chip.
    var chip: LibraryPoet?

    var body: some View {
        VStack(spacing: 4) {
            hemistich(couplet.m1).frame(maxWidth: .infinity, alignment: .leading)
            Group {
                if secondShown {
                    hemistich(couplet.m2)
                } else {
                    RoundedRectangle(cornerRadius: 10).strokeBorder(Color(hex: 0xC9C5D3), style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
                        .frame(width: 150, height: 30)
                        .accessibilityLabel("مصراع دوم")
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            if let chip { PoetChip(poet: chip).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6) }
        }
        .padding(EdgeInsets(top: 22, leading: 20, bottom: 18, trailing: 20))
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.10), radius: 7, x: 0, y: 4)
        }
        .overlay(alignment: .topTrailing) {
            if let tag {
                Text(tag).font(.title(14)).foregroundStyle(Tokens.Colors.white).padding(.top, 2).padding(.horizontal, 11)
                    .sticker(fill: tagColor, radius: Tokens.Sticker.Radius.pill, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.22))
                    .tilted(-5)
                    .padding(.trailing, 18)
                    .offset(y: -16)
                    .accessibilityLabel(tag)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("quizCouplet")
    }

    /// A hemistich set the way the reader sets its lines (the boards' 20pt, line height 1.9), wrapping when it is long.
    private func hemistich(_ text: String) -> some View {
        Text(TextNormalizer.plain(text)).multilineTextAlignment(.leading)
            .poemLine(TextSettings(), size: 20, factor: 1.9)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The poet's small circle and name, on a paper capsule.
struct PoetChip: View {
    let poet: LibraryPoet

    var body: some View {
        HStack(spacing: 6) {
            PoetCircle(poet: poet, size: 26, border: 2)
            Text(poet.name).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
        }
        .padding(EdgeInsets(top: 3, leading: 4, bottom: 3, trailing: 12))
        .background(Capsule().fill(Tokens.Colors.paper))
    }
}

/// حدس شاعر: a poet's face with the name, in a card of the 2×2 grid.
struct PoetOptionCard: View {
    let poet: LibraryPoet?
    let name: String
    let state: OptionState
    let tap: () -> Void

    var body: some View {
        Button(action: tap) {
            VStack(spacing: 8) {
                if let poet { PoetCircle(poet: poet, size: 70, border: 3) }
                Text(name).font(.ui(16, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
            }
            .frame(maxWidth: .infinity)
            .padding(EdgeInsets(top: 14, leading: 8, bottom: 10, trailing: 8))
            .background(RoundedRectangle(cornerRadius: 22).fill(state == .right ? Color(hex: 0xEEF9E7) : Tokens.Colors.white))
            .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(state.border, lineWidth: 4))
            .verdictBadge(state)
            .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 5, x: 0, y: 3)
            .opacity(state.opacity)
        }
        .buttonStyle(.plain)
        .allowsHitTesting(state == .idle || state == .selected)
        .accessibilityHidden(state == .removed)
        .accessibilityLabel(name)
        .accessibilityAddTraits(state == .selected ? .isSelected : [])
    }
}

/// مصراع دوم and گوش کن: a second hemistich on a white row. In گوش کن «یه کلمه» marks one word.
struct HemistichOptionRow: View {
    let text: String
    let state: OptionState
    /// The index of the word to mark, once the hint is used.
    var markedWord: Int?
    let tap: () -> Void

    var body: some View {
        let chosen = state == .selected
        Button(action: tap) {
            Text(label).font(.poem(18)).lineSpacing(6).multilineTextAlignment(.leading)
                .foregroundStyle(chosen ? Tokens.Colors.white : Tokens.Colors.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 14)
                .background(RoundedRectangle(cornerRadius: 20).fill(fill))
                .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(border, lineWidth: 3))
                .verdictBadge(state)
                .shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 5, x: 0, y: 3)
                .opacity(state.opacity)
        }
        .buttonStyle(.plain)
        .allowsHitTesting(state == .idle || state == .selected)
        .accessibilityHidden(state == .removed)
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }

    private var fill: Color {
        switch state {
        case .selected: Tokens.Colors.lapis
        case .right: Color(hex: 0xEEF9E7)
        default: Tokens.Colors.white
        }
    }

    private var border: Color { state == .idle || state == .dimmed || state == .removed ? Tokens.Colors.white : state.border }

    private var label: AttributedString {
        guard let markedWord else { return AttributedString(text) }
        var result = AttributedString()
        let words = text.split(whereSeparator: \.isWhitespace)
        for (index, word) in words.enumerated() {
            var piece = AttributedString(String(word))
            if index == markedWord { piece.backgroundColor = Tokens.Colors.amber.opacity(0.55) }
            result += piece
            if index < words.count - 1 { result += AttributedString(" ") }
        }
        return result
    }
}

/// از کدوم کتاب؟: a small book cover with its title.
struct BookOptionTile: View {
    let book: LibraryBook?
    let title: String
    let state: OptionState
    let tap: () -> Void

    var body: some View {
        Button(action: tap) {
            VStack(spacing: 10) {
                BookCover(color: book?.color ?? .lapis).frame(width: 86)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(outline, lineWidth: 4).padding(-4))
                Text(title).font(.title(16)).multilineTextAlignment(.center).lineLimit(3).foregroundStyle(titleColor)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity)
            .opacity(state.opacity)
            .tilted(state == .wrong ? -3 : 0)
        }
        .buttonStyle(.plain)
        .allowsHitTesting(state == .idle || state == .selected)
        .accessibilityHidden(state == .removed)
        .accessibilityLabel(title)
        .accessibilityAddTraits(state == .selected ? .isSelected : [])
    }

    private var outline: Color { state == .idle || state == .dimmed || state == .removed ? .clear : state.border }

    private var titleColor: Color {
        switch state {
        case .right: Color(hex: 0x3E9A1E)
        case .wrong: Tokens.Colors.fire
        default: Tokens.Colors.ink
        }
    }
}
