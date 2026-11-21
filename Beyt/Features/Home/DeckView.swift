import SwiftUI

/// The card stack: swipe right to keep, left for the next one, tap to read the poem,
/// hold to see the picture under your finger, eye button for the clean picture.
struct DeckView: View {
    @Binding var items: [CoupletRef]
    @Binding var index: Int
    var kind: String = "home"

    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router

    var body: some View {
        GeometryReader { geo in
            ZStack {
                if index >= items.count {
                    endCard
                } else {
                    ForEach(Array(items.enumerated()).filter { $0.offset >= index && $0.offset < index + 3 }.reversed(), id: \.element.key) { pair in
                        let depth = pair.offset - index
                        DeckCard(ref: pair.element, position: pair.offset + 1, total: items.count, depth: depth, isTop: depth == 0, size: geo.size) { dir in
                            finish(pair.element, dir)
                        }
                        .environment(\.layoutDirection, .leftToRight) // swipe maths in screen coordinates
                        .zIndex(Double(10 - depth))
                    }
                }
            }
        }
        .aspectRatio(0.82, contentMode: .fit)
        .frame(maxHeight: 510)
    }

    private func finish(_ r: CoupletRef, _ dir: Int) {
        if dir > 0 {
            if prefs.isSaved(r) { router.say("قبلاً توی دیوانت بود") } else { prefs.toggleSave(r); router.say("رفت توی دیوانت") }
        }
        prefs.markSeen(r)
        prefs.hinted = true
        withAnimation(.spring(duration: 0.4)) { index += 1 }
    }

    private var endCard: some View {
        VStack(spacing: 10) {
            Emblem(d: IconData.motifs["moon"] ?? "", size: 64, lineWidth: 1.6).foregroundStyle(prefs.accent)
            Text(kind == "home" ? "دسته‌ی امروز تموم شد" : "این دسته تموم شد").font(.ui(18, .bold))
            Text("\(prefs.saved.count.fa) بیت توی دیوانت داری.").font(.ui(13)).foregroundStyle(Palette.muted)
            HStack {
                PillButton(title: "چند تای دیگه", kind: .primary) {
                    withAnimation { items.append(contentsOf: library.randomCouplets(6)) }
                }
                PillButton(title: "کتابخانه") { router.go(.library) }
            }
            FlowLayout(spacing: 8) {
                ForEach(Content.moods.filter { $0.key != kind }.prefix(4)) { m in
                    Chip(title: m.title) { router.open(.mood(m.key)) }
                }
            }
            .padding(.top, 4)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 30).strokeBorder(Palette.line, style: StrokeStyle(lineWidth: 1.5, dash: [6, 5])))
    }
}

private struct DeckCard: View {
    let ref: CoupletRef
    let position: Int
    let total: Int
    let depth: Int
    let isTop: Bool
    let size: CGSize
    let onDone: (Int) -> Void

    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router

    @State private var drag: CGSize = .zero
    @State private var flung: Int = 0
    @State private var painted = false
    @State private var lens: CGPoint?

    var body: some View {
        let poem = library.poem(ref.url)
        let c = library.couplet(ref)
        let text = c?.text ?? ""
        ZStack {
            ArtView(ref, text: text, blur: 5)
            ArtView(ref, text: text, painted: true)
                .opacity(painted ? 1 : 0)
                .animation(.easeInOut(duration: 0.5), value: painted)
            if let p = lens {
                Group {
                    ArtView(ref, text: text, painted: true)
                        .mask(Circle().frame(width: 132, height: 132).position(p))
                    Circle().stroke(.white.opacity(0.7), lineWidth: 1.5).frame(width: 132, height: 132).position(p)
                        .shadow(color: .black.opacity(0.45), radius: 15, y: 10)
                }
                .environment(\.layoutDirection, .leftToRight)
            }
            LinearGradient(stops: [.init(color: .black.opacity(0.28), location: 0), .init(color: .clear, location: 0.22), .init(color: .clear, location: 0.38),
                                   .init(color: Color(hex: 0x08080A, alpha: 0.72), location: 0.66), .init(color: Color(hex: 0x08080A, alpha: 0.9), location: 1)],
                           startPoint: .top, endPoint: .bottom)
                .opacity(lens == nil ? 1 : 0.15)
                .allowsHitTesting(false)
            if isTop, let poem, let c {
                content(poem, c).opacity(lens == nil ? 1 : 0.15)
            }
            // Keep / next hint while dragging: centred in the picture area, fades in with the drag.
            if isTop, abs(drag.width) > 24 {
                let keep = drag.width > 0
                HStack(spacing: 8) {
                    LineIcon(name: keep ? "check" : "close", size: 20)
                    Text(keep ? "نگه دار" : "بعدی").font(.ui(16, .bold))
                }
                .foregroundStyle(keep ? prefs.onAccent : Palette.ink)
                .padding(.horizontal, 20).frame(height: 46)
                .background(Capsule().fill(keep ? prefs.accent : Palette.sunk.opacity(0.95)))
                .shadow(color: .black.opacity(0.35), radius: 14, y: 6)
                .scaleEffect(0.9 + 0.1 * min(1, (abs(drag.width) - 24) / 70))
                .opacity(min(1, (abs(drag.width) - 24) / 50))
                .frame(maxWidth: .infinity)
                .frame(height: size.height * 0.48)
                .frame(maxHeight: .infinity, alignment: .top)
                .allowsHitTesting(false)
                .transition(.opacity)
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .frame(width: size.width, height: size.height)
        .clipShape(RoundedRectangle(cornerRadius: 30))
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(.white.opacity(0.1), lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 22, y: 22)
        .scaleEffect(1 - CGFloat(depth) * 0.05, anchor: .bottom)
        .offset(y: CGFloat(depth) * 14)
        .offset(x: drag.width + CGFloat(flung) * size.width * 1.4, y: 0)
        .rotationEffect(.degrees(Double(drag.width) / 18 + Double(flung) * 20))
        .opacity(flung == 0 ? 1 : 0)
        .contentShape(RoundedRectangle(cornerRadius: 30))
        .onTapGesture { if isTop { router.openPoem(ref.url, focus: ref.index) } }
        .simultaneousGesture(isTop ? swipe : nil)
        .simultaneousGesture(isTop ? hold : nil)
        .allowsHitTesting(isTop)
        .accessibilityElement(children: .contain)
    }

    private func content(_ poem: Poem, _ c: Couplet) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                tag(Content.mood(of: ref)?.title ?? poem.formatLabel)
                Spacer()
                tag("\(position.fa) از \(total.fa)")
                glassIcon("square.and.arrow.up", "استوری") { router.show(.share(ref.url, ref.index, clear: painted)) }
                glassIcon(painted ? "eye.fill" : "eye", "نمایش تصویر", on: painted) { painted.toggle() }
            }
            .padding(14)
            Spacer()
            VStack(alignment: .leading, spacing: 10) {
                Text("\(library.nick(poem.poet)) · \(poem.title)").font(.ui(12, .medium)).foregroundStyle(Palette.softText)
                VStack(alignment: .leading, spacing: prefs.verseSpacing(23) * 0.35) {
                    BalancedText(text: c.m1, font: prefs.verseFont(23), size: 23 * prefs.font.factor * prefs.size, rowSpacing: prefs.verseSpacing(23) * 0.35)
                    if !c.m2.isEmpty { BalancedText(text: c.m2, font: prefs.verseFont(23), size: 23 * prefs.font.factor * prefs.size, rowSpacing: prefs.verseSpacing(23) * 0.35) }
                }
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.7), radius: 7, y: 1)
                if !c.meaning.isEmpty {
                    HStack(spacing: 10) {
                        Rectangle().fill(.white.opacity(0.4)).frame(width: 2)
                        Text(c.meaning.firstSentences(1)).font(.ui(13)).foregroundStyle(Color(hex: 0xE6E1D7)).lineSpacing(4).lineLimit(2)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 8) {
                    deckButton(icon: "checkmark", label: "نگه دار") { fling(1) }
                        .frame(width: 56)
                    Button { router.openPoem(ref.url, focus: ref.index) } label: {
                        HStack(spacing: 8) { AppIcon("book", size: 16); Text("کل شعر").font(.ui(14, .semibold)) }
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .foregroundStyle(.white)
                            .cardChrome(Capsule())
                    }
                    .buttonStyle(PressStyle(scale: 0.94))
                    deckButton(icon: "xmark", label: "بعدی") { fling(-1) }
                        .frame(width: 56)
                }
            }
            .padding(.horizontal, 18).padding(.bottom, 16)
        }
    }

    private func tag(_ t: String) -> some View {
        Text(t).font(.ui(12, .medium)).foregroundStyle(.white)
            .padding(.horizontal, 13).padding(.vertical, 7)
            .cardChrome(Capsule())
    }

    private func glassIcon(_ icon: String, _ label: String, on: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            AppIcon(icon, size: 15)
                .foregroundStyle(on ? prefs.onAccent : .white)
                .frame(width: 38, height: 38)
                .cardChrome(Circle(), tint: on ? prefs.accent : nil)
        }
        .buttonStyle(PressStyle(scale: 0.9))
        .accessibilityLabel(label)
    }

    private func deckButton(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            AppIcon(icon, size: 18).foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(height: 48)
                .cardChrome(Capsule())
        }
        .buttonStyle(PressStyle(scale: 0.92))
        .accessibilityLabel(label)
    }

    private func fling(_ dir: Int) {
        withAnimation(.easeIn(duration: 0.3)) { flung = dir }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(280))
            onDone(dir)
        }
    }

    @State private var axis: Int = 0 // 0 undecided, 1 horizontal, 2 vertical

    /// Horizontal swipe (works together with the page's vertical scroll).
    private var swipe: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { v in
                if lens != nil { return }
                if axis == 0 { axis = abs(v.translation.width) > abs(v.translation.height) ? 1 : 2 }
                guard axis == 1 else { return }
                drag = CGSize(width: v.translation.width, height: 0)
            }
            .onEnded { v in
                defer { axis = 0 }
                guard axis == 1, lens == nil else { return }
                if abs(drag.width) > 90 || abs(v.predictedEndTranslation.width) > 260 {
                    let dir = (drag.width > 0 || (drag.width == 0 && v.predictedEndTranslation.width > 0)) ? 1 : -1
                    withAnimation(.easeIn(duration: 0.3)) { flung = dir; drag = .zero }
                    Task { @MainActor in try? await Task.sleep(for: .milliseconds(280)); onDone(dir) }
                    return
                }
                withAnimation(.spring(duration: 0.35)) { drag = .zero }
            }
    }

    /// Hold, then move: a round lens shows the clean picture under the finger.
    private var hold: some Gesture {
        LongPressGesture(minimumDuration: 0.32, maximumDistance: 10)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .local))
            .onChanged { v in
                switch v {
                case .second(true, let d):
                    if let d {
                        if lens == nil { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
                        lens = d.location
                    }
                default: break
                }
            }
            .onEnded { _ in withAnimation(.easeOut(duration: 0.2)) { lens = nil } }
    }
}

extension View {
    /// Frosted chrome for controls on the moving card. Liquid Glass doesn't follow the card's tilt and
    /// slide well, so the card uses material; glass stays on the fixed navigation layer.
    func cardChrome<S: Shape>(_ shape: S, tint: Color? = nil) -> some View {
        background {
            if let tint { shape.fill(tint) } else { shape.fill(.ultraThinMaterial).overlay(shape.fill(.white.opacity(0.06))) }
        }
        .overlay(shape.stroke(.white.opacity(0.12), lineWidth: 0.5))
    }
}
