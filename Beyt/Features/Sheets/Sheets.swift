import SwiftUI

/// One place that builds every bottom sheet.
struct SheetHost: View {
    let route: SheetRoute
    var body: some View {
        switch route {
        case .poet(let s): PoetSheet(slug: s).presentationDetents([.large])
        case .couplet(let u, let i): CoupletSheet(url: u, index: i).presentationDetents([.medium, .large])
        case .share(let u, let i): ShareSheet(url: u, index: i).presentationDetents([.large])
        case .font: FontSheet().presentationDetents([.large])
        case .more(let u): MoreSheet(url: u).presentationDetents([.medium])
        case .summary(let u): SummarySheet(url: u).presentationDetents([.medium, .large])
        case .songs(let u): SongsSheet(url: u).presentationDetents([.medium, .large])
        case .details(let u): DetailsSheet(url: u).presentationDetents([.medium])
        case .reciters(let u): RecitersSheet(url: u).presentationDetents([.medium, .large])
        case .about: AboutSheet().presentationDetents([.medium, .large])
        }
    }
}

/// Scrollable sheet body with the standard padding.
struct SheetBody<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) { content }
                .padding(.horizontal, 18).padding(.top, 24).padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .background(Palette.bg)
    }
}

// MARK: - Poet

struct PoetSheet: View {
    let slug: String
    @Environment(Library.self) private var library
    @Environment(Router.self) private var router

    var body: some View {
        SheetBody {
            if let pt = library.poet(slug) {
                HStack(spacing: 14) {
                    PoetAvatar(slug: slug, name: pt.nick, size: 72)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(pt.nick).font(.ui(20, .bold))
                        Text(pt.fullName).font(.ui(13)).foregroundStyle(Palette.muted)
                    }
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                    if pt.death > 0 { Fact(label: "کی زندگی می‌کرد", value: "حدود \(yearsAgo(pt.death).fa) سال پیش") }
                    Fact(label: "کجا", value: pt.birthPlace.isEmpty ? "—" : pt.birthPlace + (pt.deathPlace.isEmpty || pt.deathPlace == pt.birthPlace ? "" : " ← " + pt.deathPlace))
                }
                if pt.birth > 0 {
                    Fact(label: "سال‌ها", value: "\(ceYear(pt.birth).fa) تا \(ceYear(pt.death).fa) میلادی · \(pt.birth.fa) تا \(pt.death.fa) قمری")
                }
                if !pt.bio.isEmpty {
                    Text(pt.bio).font(.ui(15)).foregroundStyle(Palette.ink).lineSpacing(8).fixedSize(horizontal: false, vertical: true)
                }
                (Text("کتاب‌ها ").font(.ui(15, .bold)) + Text("· \(pt.poemCount.fa) شعر").font(.ui(15)).foregroundColor(Palette.muted))
                VStack(spacing: 0) {
                    ForEach(pt.books) { b in
                        IconRow(title: b.title, subtitle: "\(b.count.fa) شعر\(library.isLocalBook(b.url) ? " · با معنیِ بیت‌به‌بیت" : "")") { IconSquare(icon: "book") } action: {
                            router.open(.book(b.url))
                        }
                        Divider().overlay(Palette.line)
                    }
                }
            }
        }
    }
}

// MARK: - Couplet

struct CoupletSheet: View {
    let url: String
    let index: Int
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let r = CoupletRef(url, index)
        SheetBody {
            if let p = library.poem(url), let c = library.couplet(r) {
                HStack {
                    Eyebrow("بیت \((index + 1).fa) · \(library.nick(p.poet))")
                    Spacer()
                    IconButton(icon: "xmark", size: 36, label: "بستن") { dismiss() }
                }
                CoupletLines(couplet: c, base: 21)
                if !c.meaning.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) { Eyebrow("به فارسیِ امروزی", color: Palette.ink); if c.ai { AITag() } }
                        Text(c.meaning).font(.ui(prefs.meaningSize(15))).lineSpacing(8).fixedSize(horizontal: false, vertical: true)
                    }
                    .card()
                    .background(RoundedRectangle(cornerRadius: 22).fill(prefs.accent.opacity(0.18)))
                }
                HStack(spacing: 10) {
                    PillButton(title: "ساختن استوری", icon: "square.and.arrow.up", kind: .primary, grow: true) { router.show(.share(url, index)) }
                    IconButton(icon: prefs.isSaved(r) ? "heart.fill" : "heart", tint: prefs.isSaved(r) ? prefs.accent : Palette.ink, label: "ذخیره") {
                        let on = prefs.toggleSave(r)
                        router.say(on ? "رفت توی دیوانت" : "از دیوانت برداشته شد")
                    }
                    IconButton(icon: "doc.on.doc", label: "کپی") {
                        UIPasteboard.general.string = "\(c.m1)\n\(c.m2)\n— \(library.nick(p.poet))"
                        router.say("کپی شد")
                    }
                }
            }
        }
    }
}

// MARK: - Story share

struct ShareSheet: View {
    let url: String
    let index: Int
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var bg: StoryCard.Background = .art
    @State private var withMeaning = false
    @State private var rendered: Image?

    var body: some View {
        SheetBody {
            HStack {
                Text("استوری بساز").font(.ui(17, .bold))
                Spacer()
                IconButton(icon: "xmark", size: 36, label: "بستن") { dismiss() }
            }
            if let p = library.poem(url), let c = library.couplet(CoupletRef(url, index)) {
                StoryCard(ref: CoupletRef(url, index), poem: p, couplet: c, poet: library.nick(p.poet), background: bg, meaning: withMeaning, font: prefs.font)
                    .frame(width: 230, height: 409)
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                    .shadow(color: .black.opacity(0.38), radius: 17, y: 14)
                    .frame(maxWidth: .infinity)
                HStack(spacing: 12) {
                    ForEach(StoryCard.Background.allCases, id: \.self) { b in
                        Button { bg = b } label: {
                            Circle().fill(b.swatch).frame(width: 36, height: 36)
                                .overlay(Circle().stroke(bg == b ? Palette.ink : Palette.line, lineWidth: bg == b ? 2 : 1).padding(-3))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(b.rawValue)
                    }
                }
                .frame(maxWidth: .infinity)
                Toggle(isOn: $withMeaning) { Text("معنی هم بیاد").font(.ui(15, .medium)) }
                    .tint(Palette.good)
                    .disabled(c.meaning.isEmpty)
                if let rendered {
                    ShareLink(item: rendered, preview: SharePreview(p.title, image: rendered)) {
                        HStack(spacing: 8) { AppIcon("square.and.arrow.up"); Text("ذخیره یا فرستادن").font(.ui(14, .bold)) }
                            .foregroundStyle(prefs.onAccent)
                            .frame(maxWidth: .infinity).frame(height: 48)
                            .background(Capsule().fill(prefs.accent))
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
                Note("کارت با کیفیت بالا ساخته می‌شه. از همین منو می‌تونی توی گالری ذخیره‌ش کنی یا برای استوری اینستاگرام بفرستی.")
            }
        }
        .task(id: "\(bg)\(withMeaning)") { await render() }
    }

    @MainActor private func render() async {
        guard let p = library.poem(url), let c = library.couplet(CoupletRef(url, index)) else { return }
        rendered = nil
        let ref = CoupletRef(url, index)
        // Make sure the art is ready before taking the picture.
        if bg == .art {
            let size = CGSize(width: 360, height: 640)
            let sc = Content.scene(for: url, index: index)
            _ = await Task.detached { SceneArt.image(scene: sc, seed: c.text, text: c.text, size: size, painted: false) }.value
        }
        let card = StoryCard(ref: ref, poem: p, couplet: c, poet: library.nick(p.poet), background: bg, meaning: withMeaning, font: prefs.font, staticArt: true)
            .frame(width: 360, height: 640)
            .environment(\.layoutDirection, .rightToLeft)
        let r = ImageRenderer(content: card)
        r.scale = 3
        if let ui = r.uiImage { rendered = Image(uiImage: ui) }
    }
}

/// The 9:16 card used for stories.
struct StoryCard: View {
    enum Background: String, CaseIterable { case art, lapis, saffron, paper, night
        var fill: Color {
            switch self {
            case .art: Palette.cardBlack
            case .lapis: Color(hex: 0x1E3592)
            case .saffron: Color(hex: 0xE8A23A)
            case .paper: Color(hex: 0xF6F2E9)
            case .night: Color(hex: 0x070B1C)
            }
        }
        var ink: Color {
            switch self {
            case .art: .white
            case .lapis: Color(hex: 0xFFF4DF)
            case .saffron: Color(hex: 0x2A1A03)
            case .paper: Color(hex: 0x1A2150)
            case .night: Color(hex: 0xE9ECFA)
            }
        }
        var swatch: AnyShapeStyle {
            self == .art ? AnyShapeStyle(AngularGradient(colors: [Color(hex: 0xF0A24A), Color(hex: 0x8EA7FF), Color(hex: 0xF06A7A), Color(hex: 0x3FD0C0), Color(hex: 0xF0A24A)], center: .center)) : AnyShapeStyle(fill)
        }
    }
    let ref: CoupletRef
    let poem: Poem
    let couplet: Couplet
    let poet: String
    let background: Background
    let meaning: Bool
    let font: VerseFont
    var staticArt = false

    var body: some View {
        GeometryReader { g in
            let k = g.size.width / 230
            ZStack {
                background.fill
                if background == .art {
                    if staticArt, let img = SceneArt.cached(scene: Content.scene(for: ref.url, index: ref.index), seed: couplet.text, size: CGSize(width: 360, height: 640), painted: false) {
                        Image(uiImage: img).resizable().blur(radius: 16 * k / 1.56, opaque: true).scaleEffect(1.12)
                    } else {
                        ArtView(ref, text: couplet.text, blur: 16)
                    }
                    LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: UnitPoint(x: 0.5, y: 0.25), endPoint: .bottom)
                }
                VStack(alignment: .leading) {
                    HStack {
                        Text("بیت").font(.custom("Vazirmatn", size: 20 * k).weight(.heavy))
                        Spacer()
                        Text(poet).font(.custom("Vazirmatn", size: 11 * k).weight(.bold))
                    }
                    Spacer()
                    VStack(alignment: .leading, spacing: 12 * k) {
                        VStack(spacing: 4 * k) {
                            BalancedText(text: couplet.m1, font: .custom(font.postScript, size: 15 * k * font.factor), size: 15 * k, rowSpacing: 6 * k)
                            if !couplet.m2.isEmpty { BalancedText(text: couplet.m2, font: .custom(font.postScript, size: 15 * k * font.factor), size: 15 * k, rowSpacing: 6 * k, align: 2) }
                        }
                        if meaning, !couplet.meaning.isEmpty {
                            Text(couplet.meaning.firstSentences(1)).font(.custom("Vazirmatn", size: 10.5 * k)).lineSpacing(4 * k).opacity(0.8)
                        }
                    }
                    Spacer()
                    HStack {
                        Text(poem.title)
                        Spacer()
                        Text(poem.formatLabel)
                    }
                    .font(.custom("Vazirmatn", size: 11 * k).weight(.bold))
                    .opacity(0.7)
                }
                .foregroundStyle(background.ink)
                .padding(.horizontal, 16 * k).padding(.vertical, 22 * k)
            }
        }
    }
}

// MARK: - Fonts

struct FontSheet: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var prefs = prefs
        SheetBody {
            Text("فونتِ بیت‌ها").font(.ui(17, .bold))
            Note("همه اوپن‌سورس. روی هر کدوم بزن تا همه‌جای اپ عوض شه.")
            VStack(alignment: .leading, spacing: 8) {
                HStack { Text("اندازه").font(.ui(15, .medium)); Spacer(); Text("\(Int(prefs.size * 100).fa)٪").foregroundStyle(Palette.muted) }
                Slider(value: $prefs.size, in: 0.85...1.35, step: 0.05)
            }
            if let c = library.couplet(Content.today) {
                ForEach(VerseFont.allCases) { f in
                    Button {
                        prefs.font = f
                        router.say("فونت شد " + f.label)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text(f.label).font(.ui(15, .bold)); Spacer(); Text(f.note).font(.ui(12)).foregroundStyle(Palette.muted) }
                            VStack(spacing: 2) {
                                BalancedText(text: c.m1, font: .custom(f.postScript, size: 19 * f.factor * prefs.size), size: 19, rowSpacing: 19 * f.leading * 0.5)
                                BalancedText(text: c.m2, font: .custom(f.postScript, size: 19 * f.factor * prefs.size), size: 19, rowSpacing: 19 * f.leading * 0.5, align: 2)
                            }
                        }
                        .foregroundStyle(Palette.ink)
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .background(RoundedRectangle(cornerRadius: 18).fill(Palette.surface))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(prefs.font == f ? prefs.accent : .clear, lineWidth: 2))
                    }
                    .buttonStyle(PressStyle(scale: 0.99))
                }
            }
        }
    }
}

// MARK: - Poem info

struct MoreSheet: View {
    let url: String
    @Environment(Library.self) private var library
    @Environment(Router.self) private var router

    var body: some View {
        SheetBody {
            if let p = library.poem(url) {
                Text(p.title).font(.ui(17, .bold))
                VStack(spacing: 0) {
                    if !p.summary.isEmpty {
                        IconRow(title: "خلاصه", subtitle: String(p.summary.firstSentences(1).prefix(70)) + "…") { IconSquare(icon: "lightbulb") } action: { router.show(.summary(url)) }
                        Divider().overlay(Palette.line)
                    }
                    if !p.songs.isEmpty {
                        IconRow(title: "آهنگ‌ها", subtitle: "\(p.songCount.fa) اجرا از همین شعر") { IconSquare(icon: "music.note") } action: { router.show(.songs(url)) }
                        Divider().overlay(Palette.line)
                    }
                    IconRow(title: "جزئیات", subtitle: [p.formatLabel, "\(p.couplets.count.fa) بیت", p.metre.isEmpty ? "" : "وزن و قافیه"].filter { !$0.isEmpty }.joined(separator: " · ")) { IconSquare(icon: "list.bullet") } action: { router.show(.details(url)) }
                    Divider().overlay(Palette.line)
                    IconRow(title: "استوری", subtitle: "یه کارت قشنگ از یه بیت") { IconSquare(icon: "square.and.arrow.up") } action: { router.show(.share(url, 0)) }
                }
            }
        }
    }
}

struct SummarySheet: View {
    let url: String
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    var body: some View {
        SheetBody {
            if let p = library.poem(url) {
                HStack { Text("این شعر درباره‌ی چیه؟").font(.ui(17, .bold)); Spacer(); if p.summaryAI { AITag() } }
                let first = p.summary.firstSentences(1)
                Text(first).font(.ui(prefs.meaningSize(19), .bold)).lineSpacing(8).fixedSize(horizontal: false, vertical: true)
                let rest = String(p.summary.dropFirst(first.count)).trimmingCharacters(in: .whitespaces)
                if !rest.isEmpty {
                    Text(rest).font(.ui(prefs.meaningSize(15))).foregroundStyle(Palette.muted).lineSpacing(8).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

struct SongsSheet: View {
    let url: String
    @Environment(Library.self) private var library
    var body: some View {
        SheetBody {
            if let p = library.poem(url) {
                Text("آهنگ‌هایی که با این شعر ساخته شده").font(.ui(17, .bold))
                Note("\(p.songCount.fa) اجرا به این شعر وصل شده. اینجا چند تاش:")
                VStack(spacing: 0) {
                    ForEach(p.songs, id: \.self) { s in
                        IconRow(title: s.t, subtitle: s.a + (s.al.isEmpty ? "" : " · " + s.al)) { IconSquare(icon: "music.note") }
                        Divider().overlay(Palette.line)
                    }
                }
            }
        }
    }
}

struct DetailsSheet: View {
    let url: String
    @Environment(Library.self) private var library
    @Environment(AudioPlayer.self) private var audio
    var body: some View {
        SheetBody {
            if let p = library.poem(url) {
                Text("برای کنجکاوها").font(.ui(17, .bold))
                if !p.metre.isEmpty { Fact(label: "وزن (ریتمِ شعر)", value: p.metre) }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                    if !p.rhyme.isEmpty { Fact(label: "قافیه", value: "«\(p.rhyme)»") }
                    Fact(label: "اندازه", value: "\(p.couplets.count.fa) بیت")
                    if audio.url == url, !audio.recitations.isEmpty { Fact(label: "صدا", value: "\(audio.recitations.count.fa) خوانش") }
                    if !p.formatLabel.isEmpty { Fact(label: "قالب", value: p.formatLabel) }
                }
            }
        }
    }
}

struct RecitersSheet: View {
    let url: String
    @Environment(AudioPlayer.self) private var audio
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        SheetBody {
            Text("کی بخونه؟").font(.ui(17, .bold))
            Note("\(audio.recitations.count.fa) نفر این شعر رو خوندن. هر خوانش، بیت‌به‌بیت با متن هماهنگ شده.")
            VStack(spacing: 0) {
                ForEach(Array(audio.recitations.enumerated()), id: \.element.id) { i, r in
                    IconRow(title: r.artist, subtitle: i == audio.current ? (audio.playing ? "در حال پخش" : "انتخاب شده") : "خوانش") { IconSquare(icon: "headphones") } action: {
                        audio.choose(i)
                        prefs.setReciter(i, for: url)
                        dismiss()
                        router.say("صدا عوض شد: " + r.artist)
                    }
                    Divider().overlay(Palette.line)
                }
            }
        }
    }
}

struct AboutSheet: View {
    var body: some View {
        SheetBody {
            Text("همه‌ی محتوا واقعیه، از گنجور").font(.ui(17, .bold))
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                Fact(label: "شاعر", value: 246.fa)
                Fact(label: "شعر", value: "۱۳۹٬۴۱۷")
            }
            Fact(label: "داخل خود اپ", value: "دیوان حافظ، رباعیات خیام و دوبیتی‌های باباطاهر، با معنیِ بیت‌به‌بیت")
            Fact(label: "بقیه‌ی کتاب‌ها", value: "وقتی بازشون کنی از داده‌ی عمومی گنجور میان و روی گوشی می‌مونن")
            Fact(label: "خوانش‌ها", value: "صدای واقعی خواننده‌های گنجور، هماهنگ با هر مصراع")
            Note("معنی‌ها و خلاصه‌هایی که آیکون ستاره دارن با کمک هوش مصنوعی نوشته شدن. منبع: ganjoor.net")
        }
    }
}
