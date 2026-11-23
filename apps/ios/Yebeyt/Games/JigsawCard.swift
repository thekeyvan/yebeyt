import SwiftUI

/// Where a held sticker is dropped is found in this coordinate space.
enum JigsawSpace {
    static let name = "jigsaw"
}

/// The frames of the slots, by position, in `JigsawSpace`.
private struct SlotFrames: PreferenceKey {
    static let defaultValue: [Int: CGRect] = [:]
    static func reduce(value: inout [Int: CGRect], nextValue: () -> [Int: CGRect]) {
        value.merge(nextValue()) { $1 }
    }
}

/// The couplet of جورچین بیت on a white card: the first hemistich whole, the second as word slots.
struct JigsawCard: View {
    let board: JigsawBoard
    /// The couplet is answered: every word shows as it should be.
    let revealed: Bool
    let tapSlot: (Int) -> Void
    @Binding var slotFrames: [Int: CGRect]
    @Environment(\.layoutDirection) private var direction

    var body: some View {
        VStack(spacing: 16) {
            Text(board.question.couplet.m1)
                .font(.poem(28)).lineSpacing(10)
                .foregroundStyle(Tokens.Colors.ink)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
            WrapLayout(spacing: 6, lineSpacing: 6, centered: true, rightToLeft: direction == .rightToLeft) {
                ForEach(board.question.words.indices, id: \.self) { position in
                    slot(position)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(EdgeInsets(top: 26, leading: 16, bottom: 24, trailing: 16))
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(0.14), radius: 7, x: 0, y: 4)
        }
        .overlay(alignment: .bottomTrailing) { PeeledCorner() }  // the physical left, as on the board
        .overlay(alignment: .topLeading) {
            Text(board.question.couplet.source)
                .font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 13).padding(.vertical, 3)
                .sticker(fill: Tokens.Colors.magenta, radius: Tokens.Sticker.Radius.pill, border: 4, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.22))
                .tilted(Double(Tokens.Sticker.Tilt.decorative))
                .padding(.leading, 22)
                .offset(y: -14)
        }
        .onPreferenceChange(SlotFrames.self) { slotFrames = $0 }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("jigsawCard")
    }

    @ViewBuilder private func slot(_ position: Int) -> some View {
        let word = revealed ? board.question.words[position] : board.word(at: position)
        let waiting = board.question.missing.contains(position) && !revealed
        Group {
            if let word {
                let status: WordSticker.Status = revealed ? .correct : .stuck
                Button { if waiting { tapSlot(position) } } label: { WordSticker(word: word, status: status, size: 22) }
                    .buttonStyle(.plain)
            } else {
                Button { tapSlot(position) } label: {
                    RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.paper)
                        .overlay { RoundedRectangle(cornerRadius: 14).strokeBorder(Color(hex: 0xB9B4C6), style: StrokeStyle(lineWidth: 2, dash: [5, 4])) }
                        .frame(width: 46, height: 46)
                }
                .buttonStyle(.plain)
            }
        }
        .background {
            GeometryReader { proxy in
                Color.clear.preference(key: SlotFrames.self, value: waiting ? [position: proxy.frame(in: .named(JigsawSpace.name))] : [:])
            }
        }
        .accessibilityLabel("جای \(PersianDigits.string(position + 1))")
        .accessibilityValue(word ?? "خالی")
        .accessibilityIdentifier("slot-\(position)")
    }
}

/// «برگه‌ی برچسب‌ها»: the words still to place, loose on a sheet. A sticker is tapped (it is in hand, then a slot
/// takes it) or dragged to a slot.
struct JigsawStickerSheet: View {
    let stickers: [JigsawSticker]
    let selected: JigsawSticker?
    let extras: Int
    let select: (JigsawSticker) -> Void
    let drop: (JigsawSticker, CGPoint) -> Void
    @Environment(\.layoutDirection) private var direction

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(extras > 0 ? "برگه‌ی برچسب‌ها · \(PersianDigits.string(extras)) تاش اضافه‌ست" : "برگه‌ی برچسب‌ها")
                .font(.ui(13, weight: .medium)).foregroundStyle(Tokens.Colors.muted)
            WrapLayout(spacing: 10, lineSpacing: 10, centered: true, rightToLeft: direction == .rightToLeft) {
                ForEach(stickers) { sticker in
                    LooseSticker(sticker: sticker, inHand: selected == sticker, select: select, drop: drop)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .padding(EdgeInsets(top: 14, leading: 12, bottom: 18, trailing: 12))
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 24).fill(Color(hex: 0xE7E4EE))
            RoundedRectangle(cornerRadius: 24).strokeBorder(Color(hex: 0xC9C4D4), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
        }
    }
}

/// One sticker of the sheet. Held (tapped or being dragged) it is bigger, tilted, orange and lifted.
private struct LooseSticker: View {
    let sticker: JigsawSticker
    let inHand: Bool
    let select: (JigsawSticker) -> Void
    let drop: (JigsawSticker, CGPoint) -> Void
    @State private var drag: CGSize?

    var body: some View {
        let held = inHand || drag != nil
        WordSticker(word: sticker.word, status: held ? .held : .onSheet, size: 24)
            .offset(x: drag?.width ?? 0, y: (drag?.height ?? 0) - (held ? 14 : 0))
            .zIndex(drag == nil ? 0 : 10)
            .contentShape(Rectangle())
            .onTapGesture { select(sticker) }
            .gesture(
                DragGesture(minimumDistance: 6, coordinateSpace: .named(JigsawSpace.name))
                    .onChanged { drag = $0.translation }
                    .onEnded { value in
                        drag = nil
                        drop(sticker, value.location)
                    }
            )
            .animation(.snappy(duration: 0.18), value: held)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(sticker.word)
            .accessibilityAddTraits(.isButton)
            .accessibilityValue(inHand ? "تو دستته" : "")
            .accessibilityAction { select(sticker) }
            .accessibilityIdentifier("sticker-\(sticker.id)")
    }
}
