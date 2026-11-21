import SwiftUI

/// Fal-e Hafez: make a wish, hold the button until it fills, and a ghazal opens for you.
struct FalView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @State private var progress: Double = 0
    @State private var holding = false
    @State private var result: Poem?
    @State private var last: String?
    @State private var holdTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            ScreenBar(title: "فال حافظ")
            if let p = result { resultView(p).transition(.opacity.combined(with: .move(edge: .bottom))) } else { askView.transition(.opacity) }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Palette.bg)
        .animation(.spring(duration: 0.6), value: result?.url)
    }

    private var askView: some View {
        VStack(spacing: 26) {
            Spacer()
            VStack(spacing: 10) {
                Text("یه نیت کن").font(.ui(34, .semibold))
                Text("بعد دکمه رو نگه دار تا پُر شه.\nحافظ جوابت رو با یکی از \(library.localPoems(in: "hafez/ghazal").count.fa) غزلش می‌ده.")
                    .font(.ui(15)).foregroundStyle(Palette.muted).multilineTextAlignment(.center).lineSpacing(7)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ZStack {
                Circle().fill(Palette.sunk)
                Circle().trim(from: 0, to: progress).stroke(prefs.accent, style: StrokeStyle(lineWidth: 95, lineCap: .butt)).rotationEffect(.degrees(-90)).padding(47.5)
                    .environment(\.layoutDirection, .leftToRight)
                Text("فال").font(.ui(22, .bold)).foregroundStyle(progress > 0.5 ? prefs.onAccent : Palette.ink)
            }
            .frame(width: 190, height: 190)
            .scaleEffect(holding ? 0.97 : 1)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in if !holding { start() } }
                    .onEnded { _ in end() }
            )
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("برای فال نگه دار")
            .accessibilityAction { reveal() }
            Text("«ای حافظ شیرازی، تو محرم هر رازی»").font(.ui(12)).foregroundStyle(Palette.muted)
            Spacer()
            Spacer()
        }
        .padding(.horizontal, 22)
    }

    private func start() {
        holding = true
        progress = 0
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        holdTask?.cancel()
        holdTask = Task { @MainActor in
            let t0 = Date.now
            while !Task.isCancelled {
                let p = min(1, Date.now.timeIntervalSince(t0) / 1.5)
                progress = p
                if p >= 1 { reveal(); return }
                try? await Task.sleep(for: .milliseconds(16))
            }
        }
    }

    private func end() {
        guard holding else { return }
        holding = false
        holdTask?.cancel()
        if progress < 1 {
            withAnimation(.easeOut(duration: 0.25)) { progress = 0 }
            router.say("تا آخر نگه دار")
        }
    }

    private func reveal() {
        holding = false
        holdTask?.cancel()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        let p = library.random { $0.url.hasPrefix("hafez/ghazal/") && $0.url != last }
        last = p?.url
        result = p
        progress = 0
    }

    private func resultView(_ p: Poem) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ArtView(scene: Content.scene(for: p.url), seed: p.couplets.first?.text ?? p.url, text: p.couplets.first?.text ?? "", blur: 16)
                    .frame(height: 210)
                    .clipShape(RoundedRectangle(cornerRadius: 26))
                    .overlay(RoundedRectangle(cornerRadius: 26).stroke(Palette.line, lineWidth: 1))
                HStack { Eyebrow("فالت اومد"); Spacer(); Eyebrow(p.title) }
                if !p.summary.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) { Eyebrow("پیام این غزل برای تو", color: Palette.ink); if p.summaryAI { AITag() } }
                        Text(p.summary.firstSentences(2)).font(.ui(17, .medium)).lineSpacing(8).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 22).fill(prefs.accent.opacity(0.18)))
                }
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(Array(p.couplets.prefix(2).enumerated()), id: \.offset) { i, c in
                        if i > 0 { Line().stroke(Palette.line, style: StrokeStyle(lineWidth: 1, dash: [4, 4])).frame(height: 1) }
                        VStack(alignment: .leading, spacing: 8) {
                            CoupletLines(couplet: c, base: 21)
                            if !c.meaning.isEmpty { Text(c.meaning).font(.ui(prefs.meaningSize(15))).foregroundStyle(Palette.muted).lineSpacing(7).fixedSize(horizontal: false, vertical: true) }
                        }
                    }
                }
                .padding(.horizontal, 20).padding(.vertical, 22)
                .background(RoundedRectangle(cornerRadius: 28).fill(Palette.surface))
                HStack(spacing: 10) {
                    PillButton(title: "کل غزل", icon: "book", kind: .primary, grow: true) { router.openPoem(p.url) }
                    PillButton(title: "استوری", icon: "square.and.arrow.up") { router.show(.share(p.url, 0)) }
                }
                PillButton(title: "یه نیت دیگه", kind: .ghost, grow: true) { result = nil }
            }
            .pagePadding().padding(.top, 6).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }
}
