import SwiftUI

struct HomeView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router

    @State private var deck = Content.homeDeck
    @State private var deckIndex = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                DeckView(items: $deck, index: $deckIndex)
                    .frame(maxWidth: .infinity)
                if !prefs.hinted {
                    Text("بکش راست: نگه دار · بکش چپ: بعدی\nانگشتت رو روی تصویر نگه دار تا ببینیش")
                        .font(.ui(12)).foregroundStyle(Palette.muted).multilineTextAlignment(.center).lineSpacing(5)
                        .frame(maxWidth: .infinity).padding(.top, -8)
                }
                continueCard
                suggestions
                VStack(alignment: .leading, spacing: 12) {
                    SectionTitle("حال‌وهوا", subtitle: "شعر برای همین لحظه")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(moodsForMe) { m in MoodTile(mood: m) }
                        }
                        .padding(.horizontal, 18).padding(.vertical, 2)
                    }
                    .padding(.horizontal, -18)
                }
                VStack(alignment: .leading, spacing: 12) {
                    SectionTitle(title: "از کجا شروع کنم؟") {
                        Button("کتابخانه") { router.go(.library) }.font(.ui(12, .bold)).foregroundStyle(prefs.accent)
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(Content.starters, id: \.url) { s in BookCover(url: s.url, label: s.label) }
                        }
                        .padding(.horizontal, 18).padding(.vertical, 6)
                    }
                    .padding(.horizontal, -18)
                }
                songCard
            }
            .pagePadding()
            .padding(.top, 14)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .background(Palette.bg)
    }

    private var moodsForMe: [Mood] {
        Content.moods.sorted { a, b in prefs.vibes.contains(a.key) && !prefs.vibes.contains(b.key) }
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: .now)
        return h < 12 ? "صبح بخیر" : h < 16 ? "ظهر بخیر" : h < 20 ? "عصر بخیر" : "شب بخیر"
    }

    private var persianDate: String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .persian)
        f.locale = Locale(identifier: "fa_IR")
        f.dateFormat = "EEEE d MMMM"
        return f.string(from: .now)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Eyebrow(persianDate)
                Text(greeting).font(.ui(24, .semibold)).foregroundStyle(Palette.ink)
            }
            Spacer()
            Button { router.go(.me) } label: {
                HStack(spacing: 6) {
                    AppIcon("flame", size: 14).foregroundStyle(prefs.accent)
                    Text("\(prefs.streak.fa) روز")
                    Rectangle().fill(Palette.line).frame(width: 1, height: 16)
                    Text(prefs.readCount.fa).contentTransition(.numericText()).animation(.spring, value: prefs.readCount)
                    Text("بیت")
                }
                .font(.ui(13, .semibold)).foregroundStyle(Palette.ink)
                .padding(.horizontal, 14).frame(height: 38)
                .background(Capsule().fill(Palette.surface))
                .overlay(Capsule().stroke(Palette.line, lineWidth: 1))
            }
            .buttonStyle(PressStyle())
            .accessibilityLabel("آمار خوندن")
        }
    }

    @ViewBuilder private var continueCard: some View {
        if let rec = prefs.recent.first(where: { library.poem($0.url) != nil }), let p = library.poem(rec.url) {
            let tot = max(1, p.couplets.count), at = min(rec.couplet + 1, tot)
            Button { router.openPoem(rec.url, focus: rec.couplet) } label: {
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow("ادامه بده")
                    HStack {
                        Text("\(p.title) · \(library.nick(p.poet))").font(.ui(15, .bold)).foregroundStyle(Palette.ink).lineLimit(1)
                        Spacer()
                        Text("بیت \(at.fa) از \(tot.fa)").font(.ui(13)).foregroundStyle(Palette.muted)
                    }
                    GeometryReader { g in
                        Capsule().fill(Palette.sunk).overlay(alignment: .leading) {
                            Capsule().fill(prefs.accent).frame(width: g.size.width * CGFloat(at) / CGFloat(tot))
                        }
                    }
                    .frame(height: 6)
                }
                .card()
            }
            .buttonStyle(PressStyle(scale: 0.99))
        }
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle("امروز چی بخونیم؟")
            Button { router.open(.fal) } label: {
                HStack(spacing: 12) {
                    AppIcon("sparkles", size: 18).foregroundStyle(prefs.onAccent)
                        .frame(width: 38, height: 38).background(RoundedRectangle(cornerRadius: 12).fill(prefs.accent))
                    Text("فال حافظ").font(.ui(15, .bold)).foregroundStyle(Palette.ink)
                    Spacer()
                    Text("یه نیت کن").font(.ui(12)).foregroundStyle(Palette.muted)
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 20).fill(prefs.accent.opacity(0.2)).background(RoundedRectangle(cornerRadius: 20).fill(Palette.surface)))
            }
            .buttonStyle(PressStyle())
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                tile("book", "یه غزل کوتاه", "کمتر از دو دقیقه") {
                    if let p = library.random({ $0.poet == "hafez" && $0.format == "Ghazal" && $0.couplets.count <= 7 }) { router.openPoem(p.url) }
                }
                tile("headphones", "گوش بده", "نی‌نامه با صدای واقعی") { router.openPoem("moulavi/masnavi/daftar1/sh1", play: true) }
                tile("lightbulb", "یه رباعی خیام", "چهار مصراع، یه دنیا حرف") {
                    if let p = library.random({ $0.poet == "khayyam" }) { router.openPoem(p.url, layout: "list") }
                }
                tile("shuffle", "بیت‌گردی", "ده بیت از هر جای شعر") { router.open(.mood("random")) }
            }
        }
    }

    private func tile(_ icon: String, _ title: String, _ sub: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                IconSquareSmall(icon: icon).padding(.bottom, 6)
                Text(title).font(.ui(15, .bold)).foregroundStyle(Palette.ink)
                Text(sub).font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 20).fill(Palette.surface))
        }
        .buttonStyle(PressStyle())
    }

    @ViewBuilder private var songCard: some View {
        if let p = library.poem("hafez/ghazal/sh1"), let song = p.songs.dropFirst().first ?? p.songs.first {
            Button { router.openPoem(p.url); router.show(.songs(p.url)) } label: {
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow("این شعر رو خوندن")
                    HStack(spacing: 12) {
                        IconSquare(icon: "music.note")
                        VStack(alignment: .leading, spacing: 2) {
                            Text(song.t).font(.ui(14, .bold)).foregroundStyle(Palette.ink).lineLimit(1)
                            Text("\(song.a) · آلبوم \(song.al)").font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                    }
                    Note("«الا یا ایها الساقی» حافظ رو \(p.songCount.fa) خواننده اجرا کردن. شعرش رو با معنی بخون.")
                }
                .card()
            }
            .buttonStyle(PressStyle(scale: 0.99))
        }
    }
}

struct IconSquareSmall: View {
    let icon: String
    @Environment(Prefs.self) private var prefs
    var body: some View {
        AppIcon(icon, size: 17).foregroundStyle(prefs.accent)
            .frame(width: 38, height: 38)
            .background(RoundedRectangle(cornerRadius: 12).fill(prefs.accent.opacity(0.18)))
    }
}

/// Mood tile: clear painted scene with the mood's name.
struct MoodTile: View {
    let mood: Mood
    @Environment(Library.self) private var library
    @Environment(Router.self) private var router
    var body: some View {
        let r = mood.items[0]
        let text = library.couplet(r)?.text ?? mood.title
        Button { router.open(.mood(mood.key)) } label: {
            ZStack(alignment: .bottomLeading) {
                ArtView(scene: mood.scene, seed: text, text: text, painted: true)
                LinearGradient(colors: [.clear, Color(hex: 0x08080A, alpha: 0.88)], startPoint: UnitPoint(x: 0.5, y: 0.4), endPoint: .bottom)
                VStack(alignment: .leading, spacing: 2) {
                    Text(mood.title).font(.ui(18, .semibold)).foregroundStyle(.white)
                    Text(mood.detail).font(.ui(12)).foregroundStyle(Color(hex: 0xDDD8CE)).lineLimit(1)
                }
                .padding(14)
            }
            .frame(width: 150, height: 190)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Palette.line, lineWidth: 1))
        }
        .buttonStyle(PressStyle())
    }
}

/// A book cover with a shamse ornament.
struct BookCover: View {
    let url: String
    let label: String
    @Environment(Library.self) private var library
    @Environment(Router.self) private var router
    var body: some View {
        let b = library.book(url)
        let h = hashHue(url)
        Button { router.open(.book(url)) } label: {
            ZStack(alignment: .bottomLeading) {
                LinearGradient(colors: [Color(h: h, s: 45, l: 34), Color(h: h + 25, s: 50, l: 20)], startPoint: .topLeading, endPoint: .bottomTrailing)
                SVGShape(d: IconData.shamse, box: 100)
                    .stroke(Color(hex: 0xF2C46B).opacity(0.9), lineWidth: 1.4 * 0.74)
                    .frame(width: 74, height: 74)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .padding(.top, 14)
                Rectangle().fill(.black.opacity(0.18)).frame(width: 6).frame(maxWidth: .infinity, alignment: .trailing)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(.ui(14, .semibold)).lineLimit(2)
                    if let b {
                        Text(library.nick(b.poet)).font(.ui(12)).opacity(0.85)
                        Text("\(b.count.fa) شعر\(library.isLocalBook(url) ? " · با معنی" : "")").font(.ui(11)).opacity(0.65)
                    }
                }
                .foregroundStyle(Color(hex: 0xFFF6E6))
                .padding(.horizontal, 12).padding(.vertical, 14)
            }
            .frame(width: 124, height: 178)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18, bottomTrailingRadius: 10, topTrailingRadius: 10))
            .shadow(color: .black.opacity(0.38), radius: 17, y: 14)
        }
        .buttonStyle(PressStyle())
    }
}
