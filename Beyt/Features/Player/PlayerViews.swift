import SwiftUI

// Media controls and timelines are not mirrored in right-to-left layouts (Apple HIG),
// so transport rows and scrubbers below are pinned to left-to-right.

/// Floating mini player, visible on every screen while a poem is loaded. Tap to open Now Playing.
struct MiniPlayer: View {
    @Environment(AudioPlayer.self) private var audio
    @Environment(Router.self) private var router
    @Environment(Prefs.self) private var prefs

    var body: some View {
        if let n = audio.now {
            Button { router.nowPlaying = true } label: {
                HStack(spacing: 12) {
                    ArtView(scene: n.scene, seed: n.seed, text: n.seed, painted: true)
                        .frame(width: 42, height: 42)
                        .clipShape(RoundedRectangle(cornerRadius: 9))
                        .shadow(color: .black.opacity(0.3), radius: 4, y: 2)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(currentLine ?? n.title).font(.ui(14, .semibold)).foregroundStyle(Palette.ink).lineLimit(1)
                            .contentTransition(.opacity)
                            .animation(.easeInOut(duration: 0.3), value: audio.line)
                        Text("\(n.poet) · \(audio.artist)").font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    HStack(spacing: 4) {
                        transport(audio.playing ? "pause.fill" : "play.fill", size: 22, label: audio.playing ? "توقف" : "پخش") { audio.toggle() }
                        transport("forward.fill", size: 18, label: "بیت بعد") { audio.nextCouplet() }
                    }
                    .environment(\.layoutDirection, .leftToRight)
                }
                .padding(.leading, 8).padding(.trailing, 10)
                .frame(height: 58)
                .overlay(alignment: .bottom) {
                    GeometryReader { g in
                        Capsule().fill(prefs.accent.opacity(0.9))
                            .frame(width: audio.duration > 0 ? g.size.width * CGFloat(audio.time / audio.duration) : 0, height: 2)
                    }
                    .frame(height: 2)
                    .padding(.horizontal, 18)
                    .environment(\.layoutDirection, .leftToRight)
                }
                .glass(RoundedRectangle(cornerRadius: 22), interactive: true)
                .contentShape(RoundedRectangle(cornerRadius: 22))
            }
            .buttonStyle(PressStyle(scale: 0.98))
            .shadow(color: .black.opacity(0.35), radius: 16, y: 8)
            .padding(.horizontal, 12)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityLabel("در حال پخش: \(n.title)")
        }
    }

    private var currentLine: String? {
        guard let n = audio.now, let l = audio.line, n.couplets.indices.contains(l / 2) else { return nil }
        let c = n.couplets[l / 2]
        return l % 2 == 0 || c.m2.isEmpty ? c.m1 : c.m2
    }

    private func transport(_ icon: String, size: CGFloat, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: size)).foregroundStyle(Palette.ink)
                .frame(width: 40, height: 40).contentShape(Rectangle())
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(PressStyle(scale: 0.85))
        .accessibilityLabel(label)
    }
}

/// Full-screen Now Playing, in the spirit of Apple Music: artwork or the couplets ("lyrics"),
/// a scrubber, couplet-by-couplet transport, speed and reader.
struct NowPlayingView: View {
    @Environment(AudioPlayer.self) private var audio
    @Environment(Router.self) private var router
    @Environment(Prefs.self) private var prefs
    @Environment(\.dismiss) private var dismiss
    @State private var showCouplets = false
    @State private var scrub: Double?

    var body: some View {
        if let n = audio.now {
            ZStack {
                // Background: the poem's scene, softly blurred, like Apple Music's artwork colours.
                ArtView(scene: n.scene, seed: n.seed, text: n.seed, painted: true, blur: 60)
                    .ignoresSafeArea()
                    .overlay(Color.black.opacity(0.45).ignoresSafeArea())
                VStack(spacing: 0) {
                    Capsule().fill(.white.opacity(0.35)).frame(width: 38, height: 5).padding(.top, 10)
                    if showCouplets {
                        couplets(n).transition(.opacity)
                    } else {
                        Spacer(minLength: 16)
                        ArtView(scene: n.scene, seed: n.seed, text: n.seed, painted: true)
                            .aspectRatio(1, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                            .shadow(color: .black.opacity(0.45), radius: 30, y: 18)
                            .scaleEffect(audio.playing ? 1 : 0.84)
                            .animation(.spring(duration: 0.5, bounce: 0.25), value: audio.playing)
                            .padding(.horizontal, 30)
                            .onTapGesture { withAnimation(.easeInOut(duration: 0.35)) { showCouplets = true } }
                        Spacer(minLength: 16)
                    }
                    titleRow(n).padding(.horizontal, 28).padding(.top, 12)
                    scrubber.padding(.horizontal, 28).padding(.top, 18)
                    transportRow.padding(.top, 14)
                    bottomRow.padding(.horizontal, 36).padding(.top, 18).padding(.bottom, 18)
                }
            }
            .preferredColorScheme(.dark)
        } else {
            Color.clear.onAppear { dismiss() }
        }
    }

    // MARK: pieces

    private func titleRow(_ n: AudioPlayer.NowPlaying) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(n.title).font(.ui(20, .bold)).foregroundStyle(.white).lineLimit(1)
                Text("\(n.poet) · \(audio.artist)").font(.ui(16)).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
            }
            Spacer()
            Menu {
                Button { open(n) } label: { Label("باز کردن شعر", systemImage: "book") }
                Button { dismiss(); router.show(.share(n.url, audio.couplet ?? 0)) } label: { Label("استوری از همین بیت", systemImage: "square.and.arrow.up") }
                Divider()
                Button(role: .destructive) { audio.stop(); dismiss() } label: { Label("بستن پخش", systemImage: "xmark") }
            } label: {
                Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 34, height: 34).background(Circle().fill(.white.opacity(0.15)))
            }
            .accessibilityLabel("بیشتر")
        }
    }

    private var scrubber: some View {
        let shown = scrub ?? audio.time
        let total = max(audio.duration, 0.01)
        return VStack(spacing: 6) {
            GeometryReader { g in
                let w = g.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.22))
                    Capsule().fill(.white.opacity(scrub == nil ? 0.85 : 1)).frame(width: w * CGFloat(min(1, shown / total)))
                }
                .frame(height: scrub == nil ? 6 : 10)
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { v in scrub = Double(max(0, min(1, v.location.x / w))) * total }
                        .onEnded { _ in if let s = scrub { audio.seek(to: s) }; scrub = nil }
                )
                .animation(.easeOut(duration: 0.15), value: scrub == nil)
            }
            .frame(height: 22)
            HStack {
                Text(mmss(shown)).monospacedDigit()
                Spacer()
                Text("-" + mmss(max(0, total - shown))).monospacedDigit()
            }
            .font(.ui(12, .medium)).foregroundStyle(.white.opacity(0.55))
        }
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityElement()
        .accessibilityLabel("زمان")
        .accessibilityValue("\(mmss(shown)) از \(mmss(total))")
    }

    private var transportRow: some View {
        HStack(spacing: 0) {
            Spacer()
            bigButton("backward.fill", 30, "بیت قبل") { audio.previousCouplet() }
            Spacer()
            bigButton(audio.playing ? "pause.fill" : "play.fill", 48, audio.playing ? "توقف" : "پخش") { audio.toggle() }
            Spacer()
            bigButton("forward.fill", 30, "بیت بعد") { audio.nextCouplet() }
            Spacer()
        }
        .environment(\.layoutDirection, .leftToRight)
    }

    private var bottomRow: some View {
        HStack {
            Menu {
                Picker("سرعت", selection: Binding(get: { audio.rate }, set: { audio.setRate($0) })) {
                    ForEach(AudioPlayer.rates, id: \.self) { r in Text(rateLabel(r)).tag(r) }
                }
            } label: {
                Text(rateLabel(audio.rate)).font(.ui(14, .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).frame(height: 32)
                    .background(Capsule().fill(.white.opacity(audio.rate == 1 ? 0.12 : 0.28)))
            }
            .accessibilityLabel("سرعت خوانش")
            Spacer()
            Button { withAnimation(.easeInOut(duration: 0.35)) { showCouplets.toggle() } } label: {
                Image(systemName: "quote.bubble").font(.system(size: 19))
                    .foregroundStyle(showCouplets ? Color.black : .white)
                    .frame(width: 40, height: 34)
                    .background(RoundedRectangle(cornerRadius: 9).fill(showCouplets ? Color.white : .clear))
            }
            .accessibilityLabel("بیت‌ها")
            Spacer()
            Menu {
                ForEach(Array(audio.recitations.enumerated()), id: \.element.id) { i, r in
                    Button {
                        Task { await audio.choose(i) }
                        if let u = audio.url { prefs.setReciter(i, for: u) }
                    } label: {
                        if i == audio.current { Label(r.artist, systemImage: "checkmark") } else { Text(r.artist) }
                    }
                }
            } label: {
                Image(systemName: "person.wave.2").font(.system(size: 19)).foregroundStyle(.white).frame(width: 40, height: 34)
            }
            .accessibilityLabel("خواننده")
        }
    }

    private func couplets(_ n: AudioPlayer.NowPlaying) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 26) {
                    ForEach(Array(n.couplets.enumerated()), id: \.offset) { i, c in
                        let on = audio.couplet == i
                        Button {
                            Task { await audio.seek(couplet: i); if !audio.playing { audio.resume() } }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(c.m1)
                                if !c.m2.isEmpty { Text(c.m2) }
                            }
                            .font(prefs.verseFont(25).weight(.semibold))
                            .lineSpacing(6)
                            .foregroundStyle(.white.opacity(on ? 1 : 0.35))
                            .blur(radius: on || audio.couplet == nil ? 0 : 0.6)
                            .scaleEffect(on ? 1 : 0.97, anchor: .leading)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .id(i)
                        .animation(.easeInOut(duration: 0.4), value: on)
                    }
                }
                .padding(.horizontal, 28).padding(.vertical, 40)
            }
            .scrollIndicators(.hidden)
            .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.08), .init(color: .black, location: 0.9), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
            .onAppear { if let c = audio.couplet { proxy.scrollTo(c, anchor: .center) } }
            .onChange(of: audio.couplet) { _, c in
                guard let c else { return }
                withAnimation(.easeInOut(duration: 0.5)) { proxy.scrollTo(c, anchor: .center) }
            }
        }
    }

    private func bigButton(_ icon: String, _ size: CGFloat, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.system(size: size)).foregroundStyle(.white)
                .frame(width: size * 1.9, height: size * 1.6).contentShape(Rectangle())
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(PressStyle(scale: 0.86))
        .accessibilityLabel(label)
    }

    private func open(_ n: AudioPlayer.NowPlaying) {
        dismiss()
        let at = audio.couplet
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(300))
            router.openPoem(n.url, focus: at)
        }
    }

    private func rateLabel(_ r: Float) -> String {
        (r == Float(Int(r)) ? "\(Int(r))" : String(format: "%g", r)).fa + "×"
    }
}

func mmss(_ t: Double) -> String {
    let s = max(0, Int(t))
    return "\(s / 60):\(String(format: "%02d", s % 60))".fa
}
