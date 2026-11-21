import SwiftUI

/// Three calm steps: a couplet writing itself, picking moods, and trying the reading style.
struct OnboardingView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @State private var step = 0

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if step == 0, let c = library.couplet(Content.today) {
                ArtView(scene: .moon, seed: c.text, text: c.text, blur: 16)
                    .ignoresSafeArea()
                    .overlay(LinearGradient(stops: [.init(color: Palette.bg.opacity(0.25), location: 0), .init(color: Palette.bg.opacity(0.45), location: 0.45), .init(color: Palette.bg, location: 0.82)],
                                            startPoint: .top, endPoint: .bottom).ignoresSafeArea())
                    .transition(.opacity)
            }
            VStack(spacing: 0) {
                topBar
                Group {
                    switch step {
                    case 0: WelcomeStep { next() }
                    case 1: MoodsStep { next() }
                    default: StyleStep { finish() }
                    }
                }
                .id(step)
                .transition(.asymmetric(insertion: .move(edge: .leading).combined(with: .opacity), removal: .opacity))
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 12)
        }
        .animation(.spring(duration: 0.45), value: step)
        .onAppear {
            #if DEBUG
            step = UserDefaults.standard.integer(forKey: "beytStep")
            #endif
        }
    }

    private var topBar: some View {
        HStack {
            if step > 0 {
                IconButton(icon: "chevron.backward", label: "قبلی") { step -= 1 }
            } else {
                Color.clear.frame(width: 64, height: 44)
            }
            Spacer()
            HStack(spacing: 6) {
                ForEach(0..<3) { i in Capsule().fill(i == step ? prefs.accent : .white.opacity(0.2)).frame(width: i == step ? 20 : 6, height: 6) }
            }
            .accessibilityLabel("مرحله‌ی \((step + 1).fa) از ۳")
            Spacer()
            Button("رد شو") { finish() }
                .font(.ui(14)).foregroundStyle(Palette.muted)
                .frame(width: 64, height: 44, alignment: .trailing)
                .opacity(step == 2 ? 0 : 1)
        }
        .frame(height: 44)
        .padding(.top, 8)
    }

    private func next() { step = min(2, step + 1) }
    private func finish() { prefs.onboarded = true }
}

private struct WelcomeStep: View {
    let onNext: () -> Void
    @Environment(Library.self) private var library
    @State private var shown = 0
    @State private var done = false

    var body: some View {
        let c = library.couplet(Content.today)
        let w1 = c?.m1.split(separator: " ").map(String.init) ?? []
        let w2 = c?.m2.split(separator: " ").map(String.init) ?? []
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 10) {
                words(w1, offset: 0)
                words(w2, offset: w1.count)
            }
            .font(.custom(VerseFont.parastoo.postScript, size: 23 * VerseFont.parastoo.factor))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.6), radius: 13, y: 2)
            .multilineTextAlignment(.center)
            Text(library.nick("hafez"))
                .font(.ui(13)).foregroundStyle(.white.opacity(0.55))
                .padding(.top, 18)
                .opacity(done ? 1 : 0)
            Spacer()
            VStack(spacing: 14) {
                Text("شعرِ فارسی، به زبونِ امروز.").font(.ui(21)).foregroundStyle(Palette.ink)
                PillButton(title: "بزن بریم", kind: .primary, grow: true, action: onNext)
                    .frame(height: 54)
            }
            .opacity(done ? 1 : 0)
        }
        .task {
            let total = w1.count + w2.count
            try? await Task.sleep(for: .milliseconds(500))
            for i in 1...max(1, total) {
                withAnimation(.easeOut(duration: 0.6)) { shown = i }
                try? await Task.sleep(for: .milliseconds(i == w1.count ? 380 : 130))
            }
            try? await Task.sleep(for: .milliseconds(350))
            withAnimation(.easeOut(duration: 0.8)) { done = true }
        }
    }

    private func words(_ ws: [String], offset: Int) -> some View {
        FlowLayout(spacing: 6, centered: true, balanced: true) {
            ForEach(Array(ws.enumerated()), id: \.offset) { i, w in
                Text(w)
                    .opacity(offset + i < shown ? 1 : 0)
                    .blur(radius: offset + i < shown ? 0 : 8)
                    .offset(y: offset + i < shown ? 0 : 8)
            }
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
    }
}

private struct MoodsStep: View {
    let onNext: () -> Void
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("چی به دلت می‌شینه؟").font(.ui(25, .semibold))
                        Text("چند تا انتخاب کن تا پیشنهادهای خانه از همین‌ها شروع بشه.").font(.ui(14.5)).foregroundStyle(Palette.muted).lineSpacing(6)
                    }
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                        ForEach(Content.moods) { m in tile(m) }
                    }
                }
                .padding(.top, 14)
            }
            .scrollIndicators(.hidden)
            PillButton(title: prefs.vibes.isEmpty ? "بعدی" : "بعدی (\(prefs.vibes.count.fa) تا)", kind: .primary, grow: true, action: onNext)
                .frame(height: 54).padding(.top, 12)
        }
    }

    private func tile(_ m: Mood) -> some View {
        let on = prefs.vibes.contains(m.key)
        let text = library.couplet(m.items[0])?.text ?? m.title
        return Button {
            if on { prefs.vibes.removeAll { $0 == m.key } } else { prefs.vibes.append(m.key) }
        } label: {
            ZStack(alignment: .bottomLeading) {
                ArtView(scene: m.scene, seed: text, text: text, painted: true)
                LinearGradient(colors: [Color(hex: 0x0A0A0C, alpha: 0.05), Color(hex: 0x0A0A0C, alpha: 0.85)], startPoint: UnitPoint(x: 0.5, y: 0.1), endPoint: .bottom)
                VStack(alignment: .leading, spacing: 1) {
                    Text(m.title).font(.ui(16, .semibold)).foregroundStyle(.white)
                    Text(m.detail).font(.ui(11.5)).foregroundStyle(Color(hex: 0xD4CFC5)).lineLimit(1)
                }
                .padding(.horizontal, 12).padding(.bottom, 10)
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(on ? prefs.accent : .white.opacity(0.7))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(10)
            }
            .frame(height: 108)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(on ? prefs.accent : Palette.line, lineWidth: 1.5))
        }
        .buttonStyle(PressStyle())
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

private struct StyleStep: View {
    let onDone: () -> Void
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs

    var body: some View {
        let m = Content.moods.first { prefs.vibes.contains($0.key) } ?? Content.moods[1]
        let r = m.items[0]
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("این‌جوری خوبه؟").font(.ui(25, .semibold))
                        Text("همین‌جا امتحان کن. بعداً هم از «من» عوض می‌شه.").font(.ui(14.5)).foregroundStyle(Palette.muted)
                    }
                    if let p = library.poem(r.url), let c = library.couplet(r) {
                        ZStack(alignment: .bottomLeading) {
                            ArtView(scene: m.scene, seed: c.text, text: c.text, blur: 8)
                            LinearGradient(colors: [.clear, Color(hex: 0x0A0A0C, alpha: 0.88)], startPoint: UnitPoint(x: 0.5, y: 0.1), endPoint: UnitPoint(x: 0.5, y: 0.68))
                            VStack(alignment: .leading, spacing: 10) {
                                Text("\(library.nick(p.poet)) · \(m.title)").font(.ui(12, .medium)).foregroundStyle(Palette.softText)
                                VStack(alignment: .leading, spacing: 0) { Text(c.m1); Text(c.m2) }
                                    .font(prefs.verseFont(21)).foregroundStyle(.white).lineSpacing(prefs.verseSpacing(21) * 0.3)
                                if prefs.meanings {
                                    HStack(spacing: 10) {
                                        Rectangle().fill(.white.opacity(0.4)).frame(width: 2)
                                        Text(c.meaning.firstSentences(1)).font(.ui(13)).foregroundStyle(Color(hex: 0xE6E1D7)).lineSpacing(4).lineLimit(3)
                                    }
                                    .fixedSize(horizontal: false, vertical: true)
                                    .transition(.opacity)
                                }
                            }
                            .padding(18)
                        }
                        .frame(minHeight: 250)
                        .clipShape(RoundedRectangle(cornerRadius: 26))
                        .overlay(RoundedRectangle(cornerRadius: 26).stroke(Palette.line, lineWidth: 1))
                        .animation(.easeInOut, value: prefs.meanings)
                        .animation(.easeInOut, value: prefs.font)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("معنی").font(.ui(12, .bold)).foregroundStyle(Palette.muted)
                        HStack(spacing: 0) {
                            seg("شعر + معنیِ ساده", prefs.meanings) { prefs.meanings = true }
                            seg("فقط شعر", !prefs.meanings) { prefs.meanings = false }
                        }
                        .padding(4)
                        .background(Capsule().fill(Palette.surface))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("فونت").font(.ui(12, .bold)).foregroundStyle(Palette.muted)
                        FlowLayout(spacing: 8) {
                            ForEach([VerseFont.parastoo, .gandom, .sahel, .shabnam, .nastaliq]) { f in
                                Button { prefs.font = f } label: {
                                    Text(f.label).font(.custom(f.postScript, size: 15 * f.factor))
                                        .padding(.horizontal, 16).frame(height: 40)
                                        .foregroundStyle(prefs.font == f ? Palette.bg : Palette.ink)
                                        .background(Capsule().fill(prefs.font == f ? Palette.ink : Palette.surface))
                                        .overlay(Capsule().stroke(Palette.line, lineWidth: 1))
                                }
                                .buttonStyle(PressStyle())
                            }
                        }
                    }
                }
                .padding(.top, 14)
            }
            .scrollIndicators(.hidden)
            PillButton(title: "شروع کن", kind: .primary, grow: true, action: onDone)
                .frame(height: 54).padding(.top, 12)
        }
    }

    private func seg(_ t: String, _ on: Bool, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.spring(duration: 0.3)) { action() } } label: {
            Text(t).font(.ui(13, .medium))
                .foregroundStyle(on ? Palette.ink : Palette.muted)
                .frame(maxWidth: .infinity).frame(height: 36)
                .background(Capsule().fill(on ? prefs.accent.opacity(0.22) : .clear))
        }
        .buttonStyle(.plain)
    }
}
