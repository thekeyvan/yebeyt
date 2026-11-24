import SwiftUI

/// The whole poem: every couplet with the two-square separators, and the floating bar with بخون برام,
/// نگه دار and بفرست. The bar acts on the couplet nearest the top of the screen.
struct WholePoemView: View {
    @Environment(TextSettingsStore.self) private var text
    @Environment(ReaderMarks.self) private var marks
    let model: ReaderModel

    private static let space = "poemList"

    var body: some View {
        let settings = text.settings
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 14) {
                    ForEach(model.couplets.indices, id: \.self) { index in
                        if index > 0 { separator }
                        row(index, settings: settings).id(index)
                    }
                }
                .padding(.horizontal, 26)
                .padding(.top, 20)
                .padding(.bottom, 120)
            }
            .scrollIndicators(.hidden)
            .coordinateSpace(name: Self.space)
            .onPreferenceChange(RowFramesKey.self) { rows in
                if let top = CoupletPaging.nearestToTop(rows) { model.topIndex = top }
            }
            .onChange(of: model.player?.activeCouplet) { _, active in
                if let active { withAnimation(.snappy) { proxy.scrollTo(active, anchor: .center) } }
            }
            .onAppear { proxy.scrollTo(model.topIndex, anchor: .top) }
        }
        .mask {
            GeometryReader { geometry in
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black, location: min(22 / max(geometry.size.height, 1), 0.2)),
                        .init(color: .black, location: 0.84),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .top, endPoint: .bottom
                )
            }
        }
        .overlay(alignment: .bottom) { bar.padding(.bottom, 24) }
    }

    private func row(_ index: Int, settings: TextSettings) -> some View {
        let active = model.player?.activeCouplet == index && model.player?.state != .idle
        return CoupletText(couplet: model.couplets[index], settings: settings, size: settings.listSize, factor: settings.listFactor, color: settings.theme.foreground)
            .accessibilityIdentifier("couplet-\(index)")
            .onAppear { if index == model.couplets.count - 1 { model.markReachedEnd() } }
            .padding(.horizontal, 10)
            .background(RoundedRectangle(cornerRadius: 14).fill(active ? Tokens.Colors.lapis.opacity(0.12) : .clear))
            .padding(.horizontal, -10)
            .contentShape(Rectangle())
            .onTapGesture { model.openCouplet(index) }
            .onLongPressGesture(minimumDuration: 0.5) { model.holdIndex = index }
            .accessibilityAddTraits(.isButton)
            .background {
                GeometryReader { proxy in
                    let frame = proxy.frame(in: .named(Self.space))
                    Color.clear.preference(key: RowFramesKey.self, value: [CoupletPaging.Row(index: index, minY: frame.minY, maxY: frame.maxY)])
                }
            }
    }

    /// Lapis then fire: the two small squares between couplets.
    private var separator: some View {
        HStack(spacing: 3) {
            RoundedRectangle(cornerRadius: 2).fill(Tokens.Colors.lapis).frame(width: 6, height: 9)
            RoundedRectangle(cornerRadius: 2).fill(Tokens.Colors.fire).frame(width: 6, height: 9)
        }
        .accessibilityHidden(true)
    }

    private var bar: some View {
        HStack(spacing: 8) {
            if let player = model.player, player.isAvailable { readButton(player) }
            let kept = marks.contains(.kept, poemPath: model.path, couplet: model.topIndex)
            round("نگه دار", .keep, on: kept, id: model.topIndex) {
                marks.toggle(.kept, poemPath: model.path, couplet: model.topIndex)
            } icon: {
                LineIcon(shape: BookmarkIcon(), size: 20, lineWidth: 2.2, fill: kept ? Tokens.Colors.ink : nil)
            }
            round("بفرست", .send) {
                model.shareCouplet(model.topIndex)
            } icon: {
                LineIcon(shape: MessagesIcon(), size: 20, lineWidth: 2.2, fill: nil)
            }
        }
        .padding(6)
        .background {
            Capsule().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.16), radius: 8, x: 0, y: 4)
        }
    }

    private func readButton(_ player: RecitationPlayer) -> some View {
        Button {
            model.togglePlayback()
        } label: {
            HStack(spacing: 8) {
                if player.isPlaying {
                    HStack(spacing: 3) {
                        RoundedRectangle(cornerRadius: 2).frame(width: 3.5, height: 12)
                        RoundedRectangle(cornerRadius: 2).frame(width: 3.5, height: 12)
                    }
                } else {
                    PlayIcon().fill(Tokens.Colors.white).frame(width: 14, height: 14)
                }
                Text(player.isPlaying ? "مکث" : "بخون برام").font(.ui(14, weight: .bold, scaled: false))
            }
            .foregroundStyle(Tokens.Colors.white)
            .padding(.leading, 18)
            .padding(.trailing, 16)
            .frame(height: 44)
            .background(Capsule().fill(Tokens.Colors.lapis))
        }
        .buttonStyle(.plain)
    }

    private func round(_ label: String, _ mark: Burst.Action, on: Bool = false, id: AnyHashable = 0, action: @escaping () -> Void, @ViewBuilder icon: @escaping () -> some View) -> some View {
        MarkButton(action: action) { taps in
            icon()
                .markMotion(mark, on: on, id: id, taps: taps)
                .foregroundStyle(Tokens.Colors.ink)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Tokens.Colors.paper))
        }
        .buttonStyle(.press)
        .accessibilityLabel(label)
    }
}

private struct RowFramesKey: PreferenceKey {
    static let defaultValue: [CoupletPaging.Row] = []

    static func reduce(value: inout [CoupletPaging.Row], nextValue: () -> [CoupletPaging.Row]) {
        value.append(contentsOf: nextValue())
    }
}
