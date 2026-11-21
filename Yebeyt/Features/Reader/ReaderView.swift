import SwiftUI

/// Poem reader: one couplet at a time ("یکی‌یکی") or the whole poem ("کل شعر"),
/// with meanings and a real recitation that follows the text line by line.
struct ReaderView: View {
    let url: String
    var focus: Int?
    var autoplay = false
    var layout: String?

    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @Environment(AudioPlayer.self) private var audio

    @State private var poem: Poem?
    @State private var failed = false
    @State private var mode = "focus"
    @State private var page = 0
    @State private var shown: Set<Int> = []
    @State private var allMeanings = false
    @State private var listShown: Set<Int> = []
    @State private var listTop = 0
    @State private var recs: [AudioPlayer.Recitation] = []
    @State private var starting = false

    var body: some View {
        ZStack(alignment: .top) {
            Palette.bg.ignoresSafeArea()
            if let poem {
                backdrop(poem)
                VStack(spacing: 0) {
                    topBar(poem)
                    layoutSwitch
                    if mode == "focus" { focusView(poem).transition(.opacity) } else { listView(poem).transition(.opacity) }
                    playerBar(poem)
                }
            } else if failed {
                VStack(spacing: 0) {
                    ScreenBar(title: "")
                    Spacer()
                    EmptyNote(text: "این شعر بار نشد.\nاینترنت رو چک کن و دوباره امتحان کن.").pagePadding()
                    PillButton(title: "دوباره", kind: .primary) { Task { await load() } }.padding(.top, 14)
                    Spacer()
                }
            } else {
                VStack { ScreenBar(title: ""); Spacer(); ProgressView().tint(Palette.muted); Spacer() }
            }
        }
        .task { await load() }
        .onChange(of: audio.line) { _, l in follow(l) }
    }

    private func load() async {
        failed = false
        do {
            let p = try await library.load(url)
            mode = layout ?? prefs.layout
            shown = prefs.meanings ? Set(0..<p.couplets.count) : []
            let start = min(max(0, focus ?? 0), max(0, p.couplets.count - 1))
            page = start
            listTop = start
            poem = p
            prefs.remember(url, couplet: start)
            if !p.couplets.isEmpty { prefs.markSeen(CoupletRef(url, start)) }
            recs = await audio.recitations(for: url)
            if autoplay, !recs.isEmpty { await listen(from: focus) }
        } catch {
            failed = true
        }
    }

    // MARK: pieces

    private func backdrop(_ p: Poem) -> some View {
        ArtView(scene: Content.scene(for: url), seed: p.couplets.first?.text ?? url, text: p.couplets.first?.text ?? "", blur: 14)
            .frame(height: UIScreen.main.bounds.height * 0.52)
            .mask(LinearGradient(colors: [.black, .clear], startPoint: UnitPoint(x: 0.5, y: 0.1), endPoint: .bottom))
            .opacity(0.5)
            .ignoresSafeArea(edges: .top)
            .allowsHitTesting(false)
    }

    private func topBar(_ p: Poem) -> some View {
        HStack(spacing: 8) {
            BackButton()
            Button { router.show(.poet(p.poet)) } label: {
                HStack(spacing: 8) {
                    PoetAvatar(slug: p.poet, name: library.nick(p.poet), size: 30)
                    (Text(library.nick(p.poet)).font(.ui(13, .bold)).foregroundColor(Palette.ink) + Text(" · \(p.title)").font(.ui(13)).foregroundColor(Palette.muted))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            IconButton(icon: "textformat.size", label: "فونت و اندازه‌ی شعر") { router.show(.font) }
            IconButton(icon: "ellipsis", label: "درباره‌ی این شعر") { router.show(.more(url)) }
        }
        .padding(.horizontal, 12).padding(.top, 6).padding(.bottom, 4)
    }

    private var layoutSwitch: some View {
        HStack(spacing: 0) {
            switchButton("focus", "rectangle.stack", "یکی‌یکی")
            switchButton("list", "list.bullet", "کل شعر")
        }
        .padding(4)
        .background(alignment: mode == "focus" ? .leading : .trailing) {
            Capsule().fill(prefs.accent.opacity(0.22)).background(Capsule().fill(Palette.surface))
                .frame(width: 118).padding(4)
        }
        .glass(Capsule())
        .padding(.bottom, 6)
        .animation(.spring(duration: 0.4), value: mode)
    }

    private func switchButton(_ m: String, _ icon: String, _ title: String) -> some View {
        Button {
            guard m != mode else { return }
            withAnimation(.easeInOut(duration: 0.3)) {
                if m == "list" { listTop = page } else { page = listTop }
                mode = m
            }
            prefs.layout = m
        } label: {
            HStack(spacing: 6) {
                AppIcon(icon, size: 14).foregroundStyle(mode == m ? prefs.accent : Palette.muted)
                Text(title).font(.ui(13, .medium)).foregroundStyle(mode == m ? Palette.ink : Palette.muted)
            }
            .frame(width: 118, height: 36)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: focus mode

    private func focusView(_ p: Poem) -> some View {
        let n = p.couplets.count
        return VStack(spacing: 0) {
            progress(n)
            TabView(selection: $page) {
                ForEach(0..<n, id: \.self) { i in
                    focusPage(p, i).tag(i)
                }
                endPage(p).tag(n)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .onChange(of: page) { _, i in
                guard i < n else { return }
                prefs.remember(url, couplet: i)
                prefs.markSeen(CoupletRef(url, i))
            }
            if page < n {
                HStack(spacing: 10) {
                    if !p.couplets[page].meaning.isEmpty {
                        Button { toggleMeaning(page) } label: {
                            HStack(spacing: 6) {
                                AppIcon("lightbulb", size: 14).foregroundStyle(prefs.accent)
                                Text(shown.contains(page) ? "بستن معنی" : "یعنی چی؟").font(.ui(13, .medium)).foregroundStyle(Palette.ink)
                            }
                            .padding(.horizontal, 16).frame(height: 38)
                            .glass(Capsule(), interactive: true)
                        }
                        .buttonStyle(PressStyle())
                    }
                    if !recs.isEmpty, !(audio.url == url && audio.playing && audio.couplet == page) {
                        Button { Task { await listen(from: page) } } label: {
                            HStack(spacing: 6) {
                                LineIcon(name: "play", size: 13).foregroundStyle(prefs.accent)
                                Text("از این بیت بخون").font(.ui(13, .medium)).foregroundStyle(Palette.ink)
                            }
                            .padding(.horizontal, 16).frame(height: 38)
                            .glass(Capsule(), interactive: true)
                        }
                        .buttonStyle(PressStyle())
                    }
                }
                .padding(.top, 6).padding(.bottom, 12)
                .frame(minHeight: 56)
            } else {
                Color.clear.frame(height: 56)
            }
        }
    }

    @ViewBuilder private func progress(_ n: Int) -> some View {
        if n <= 12 {
            HStack(spacing: 4) {
                ForEach(0...n, id: \.self) { i in
                    Capsule().fill(i <= page ? prefs.accent : Palette.line).frame(height: 3)
                }
            }
            .padding(.horizontal, 20).padding(.top, 4)
            .animation(.easeOut(duration: 0.3), value: page)
        } else {
            GeometryReader { g in
                Capsule().fill(Palette.line).overlay(alignment: .leading) {
                    Capsule().fill(prefs.accent).frame(width: g.size.width * CGFloat(page) / CGFloat(max(1, n)))
                }
            }
            .frame(height: 3).padding(.horizontal, 20).padding(.top, 4)
            .animation(.easeOut(duration: 0.3), value: page)
        }
    }

    private func focusPage(_ p: Poem, _ i: Int) -> some View {
        let c = p.couplets[i]
        let hl: Int? = audio.url == url && audio.playing ? audio.line.flatMap { $0 / 2 == i ? $0 % 2 : nil } : nil
        return ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                CoupletLines(couplet: c, base: 26, highlight: hl)
                    .contentShape(Rectangle())
                    .onTapGesture { toggleMeaning(i) }
                if shown.contains(i), !c.meaning.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        Rectangle().fill(.clear).frame(height: 1)
                            .overlay(Line().stroke(Palette.line, style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
                        HStack(alignment: .top, spacing: 8) {
                            if c.ai { AITag() }
                            Text(c.meaning).font(.ui(prefs.meaningSize(15))).foregroundStyle(Palette.ink.opacity(0.78)).lineSpacing(7)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.top, 14)
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .padding(.horizontal, 28).padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 420)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize)
        .defaultScrollAnchor(.center)
    }

    private func endPage(_ p: Poem) -> some View {
        VStack(spacing: 20) {
            Eyebrow("تمومش کردی")
            if !p.summary.isEmpty {
                Text(p.summary.firstSentences(1)).font(.ui(prefs.meaningSize(19), .bold)).foregroundStyle(Palette.ink)
                    .multilineTextAlignment(.center).lineSpacing(8)
            }
            HStack {
                PillButton(title: "استوری", icon: "square.and.arrow.up", kind: .primary) { router.show(.share(url, 0)) }
                if !p.summary.isEmpty { PillButton(title: "خلاصه‌ی کامل") { router.show(.summary(url)) } }
            }
        }
        .padding(.horizontal, 28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func toggleMeaning(_ i: Int) {
        withAnimation(.easeInOut(duration: 0.3)) {
            if shown.contains(i) { shown.remove(i) } else { shown.insert(i) }
        }
    }

    // MARK: list mode

    private func listView(_ p: Poem) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Button {
                            allMeanings.toggle()
                            withAnimation { listShown = allMeanings ? Set(0..<p.couplets.count) : [] }
                        } label: { tinyToggle(allMeanings ? "بستن همه" : "همه‌ی معنی‌ها") }
                            .buttonStyle(.plain)
                        Spacer()
                    }
                    .padding(.vertical, 4)
                    ForEach(Array(p.couplets.enumerated()), id: \.offset) { i, c in
                        let hl: Int? = audio.url == url && audio.playing ? audio.line.flatMap { $0 / 2 == i ? $0 % 2 : nil } : nil
                        VStack(alignment: .leading, spacing: 4) {
                            CoupletLines(couplet: c, base: 21, highlight: hl)
                                .contentShape(Rectangle())
                                .onTapGesture { router.show(.couplet(url, i)) }
                            HStack(spacing: 8) {
                                if !c.meaning.isEmpty {
                                    Button {
                                        withAnimation { if listShown.contains(i) { listShown.remove(i) } else { listShown.insert(i) } }
                                    } label: { tinyToggle(listShown.contains(i) ? "بستن" : "معنی") }
                                        .buttonStyle(.plain)
                                }
                                if !recs.isEmpty {
                                    Button { Task { await listen(from: i) } } label: {
                                        HStack(spacing: 4) { LineIcon(name: "play", size: 10); Text("از اینجا بخون").font(.ui(12, .bold)) }
                                            .foregroundStyle(prefs.accent)
                                            .padding(.horizontal, 10).padding(.vertical, 4)
                                            .background(Capsule().fill(prefs.accent.opacity(0.15)))
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("از این بیت بخون")
                                }
                            }
                            if !c.meaning.isEmpty {
                                if listShown.contains(i) {
                                    HStack(alignment: .top, spacing: 8) {
                                        if c.ai { AITag() }
                                        Text(c.meaning).font(.ui(prefs.meaningSize(15))).foregroundStyle(Palette.muted).lineSpacing(7)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                    .padding(.horizontal, 4)
                                    .transition(.opacity)
                                }
                            }
                        }
                        .padding(.vertical, 12)
                        .id(i)
                        .onAppear { prefs.markSeen(CoupletRef(url, i)) }
                        Divider().overlay(Palette.line)
                    }
                }
                .padding(.horizontal, 18).padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .onAppear { if listTop > 0 { proxy.scrollTo(listTop, anchor: .top) } }
            .onChange(of: audio.line) { _, l in
                guard mode == "list", let l, l % 2 == 0 else { return }
                withAnimation(.easeInOut(duration: 0.5)) { proxy.scrollTo(l / 2, anchor: .center) }
            }
        }
    }

    private func tinyToggle(_ t: String) -> some View {
        Text(t).font(.ui(12, .bold)).foregroundStyle(Palette.lapis)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(Capsule().fill(Palette.lapisSoft))
    }

    // MARK: player

    /// While another poem (or nothing) is playing, a bar to start listening to this one.
    /// Once this poem plays, the app-wide mini player takes over.
    @ViewBuilder private func playerBar(_ p: Poem) -> some View {
        if audio.url != url, !recs.isEmpty {
            let reader = recs[min(prefs.reciter(for: url), recs.count - 1)]
            HStack(spacing: 12) {
                Button { Task { await listen(from: mode == "focus" ? min(page, max(0, p.couplets.count - 1)) : nil) } } label: {
                    Group {
                        if starting || audio.loading { ProgressView().tint(prefs.onAccent) }
                        else { LineIcon(name: "play", size: 20) }
                    }
                    .foregroundStyle(prefs.onAccent)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(prefs.accent))
                }
                .buttonStyle(PressStyle(scale: 0.92))
                .accessibilityLabel("پخش")
                VStack(alignment: .leading, spacing: 2) {
                    Text("گوش بده").font(.ui(14, .bold)).foregroundStyle(Palette.ink)
                    Button { if recs.count > 1 { router.show(.reciters(url)) } } label: {
                        HStack(spacing: 4) {
                            Text("با صدای \(reader.artist)").font(.ui(12)).lineLimit(1)
                            if recs.count > 1 { Text("· \(recs.count.fa) خوانش").font(.ui(12)); AppIcon("chevron.down", size: 9).opacity(0.6) }
                        }
                        .foregroundStyle(Palette.muted)
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(.vertical, 8).padding(.leading, 10).padding(.trailing, 14)
            .glass(RoundedRectangle(cornerRadius: 22))
            .padding(.horizontal, 12).padding(.bottom, 8)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    /// Plays this poem, from a couplet if given.
    private func listen(from couplet: Int?) async {
        guard let p = poem ?? library.poem(url) else { return }
        starting = true
        await audio.play(p, poet: library.nick(p.poet), reciter: prefs.reciter(for: url), from: couplet)
        starting = false
        if let c = couplet, mode == "focus", c != page { withAnimation { page = c } }
    }

    private func follow(_ line: Int?) {
        guard let line, line % 2 == 0, audio.url == url, audio.playing, mode == "focus", let p = poem else { return }
        let target = min(line / 2, p.couplets.count - 1)
        if target != page { withAnimation(.easeInOut(duration: 0.45)) { page = target } }
    }
}

struct BackButton: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View { IconButton(icon: "chevron.backward", label: "برگشت") { dismiss() } }
}

struct Line: Shape {
    func path(in r: CGRect) -> Path { Path { p in p.move(to: CGPoint(x: r.minX, y: r.midY)); p.addLine(to: CGPoint(x: r.maxX, y: r.midY)) } }
}
