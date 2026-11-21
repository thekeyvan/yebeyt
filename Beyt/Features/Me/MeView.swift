import SwiftUI

struct MeView: View {
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var prefs = prefs
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 12) {
                    AppIcon("person", size: 22).foregroundStyle(prefs.accent)
                        .frame(width: 52, height: 52)
                        .background(Circle().fill(prefs.accent.opacity(0.18)).background(Circle().fill(Palette.surface)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("دیوانِ من").font(.ui(24, .semibold))
                        Text("هر بیتی که نگه داری اینجا می‌مونه").font(.ui(13)).foregroundStyle(Palette.muted)
                    }
                }
                HStack(spacing: 10) {
                    stat(prefs.readCount, "بیت خوندی")
                    stat(prefs.streak, "روز پشتِ هم")
                    stat(prefs.saved.count, "نگه داشتی")
                }
                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle("نگه‌داشته‌ها")
                    if prefs.saved.isEmpty {
                        EmptyNote(text: "هنوز چیزی نگه نداشتی.\nکارت‌ها رو به راست بکش تا اینجا بیان.")
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                            ForEach(prefs.saved) { r in SavedTile(ref: r) }
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 0) {
                    SectionTitle("تنظیمات").padding(.bottom, 4)
                    row {
                        HStack { Text("رنگ اپ").font(.ui(15, .medium)); Spacer(); Text(prefs.accentChoice.label).foregroundStyle(Palette.muted) }
                        HStack(spacing: 12) {
                            ForEach(Accent.allCases) { a in
                                Button { withAnimation { prefs.accentChoice = a } } label: {
                                    Circle().fill(a.color).frame(width: 38, height: 38)
                                        .overlay(Circle().stroke(Palette.bg, lineWidth: 3))
                                        .overlay(Circle().stroke(prefs.accentChoice == a ? Palette.ink : Palette.line, lineWidth: prefs.accentChoice == a ? 2 : 1).padding(-1))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(a.label)
                            }
                        }
                    }
                    row {
                        Toggle(isOn: $prefs.meanings) { Text("معنی رو همیشه نشون بده").font(.ui(15, .medium)) }.tint(Palette.good)
                    }
                    row { navRow("فونت و اندازه‌ی شعر") { router.show(.font) } }
                    row { navRow("این اپ از چه داده‌ای ساخته شده؟") { router.show(.about) } }
                    row {
                        Button { prefs.resetOnboarding() } label: {
                            Text("دوباره از اول (معرفی اپ)").font(.ui(15, .medium)).foregroundStyle(Palette.lapis).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text("بیت · نسخه‌ی آزمایشی \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")".fa)
                    .font(.ui(12)).foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
            }
            .pagePadding().padding(.top, 14).padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .background(Palette.bg)
    }

    private func stat(_ n: Int, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(n.fa).font(.ui(24, .heavy)).contentTransition(.numericText())
            Text(label).font(.ui(12)).foregroundStyle(Palette.muted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 18).fill(Palette.surface))
    }

    private func row<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) { c() }
            .padding(.vertical, 14)
            .overlay(alignment: .bottom) { Rectangle().fill(Palette.line).frame(height: 1) }
    }

    private func navRow(_ t: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack { Text(t).font(.ui(15, .medium)); Spacer(); AppIcon("chevron.forward", size: 13).foregroundStyle(Palette.muted) }
                .foregroundStyle(Palette.ink).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// A kept couplet: clear painted scene with the first line.
struct SavedTile: View {
    let ref: CoupletRef
    @Environment(Library.self) private var library
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    var body: some View {
        if let p = library.poem(ref.url), let c = library.couplet(ref) {
            Button { router.openPoem(ref.url, focus: ref.index) } label: {
                Color.clear
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .overlay {
                        ZStack(alignment: .bottomLeading) {
                            ArtView(ref, text: c.text, painted: true)
                            LinearGradient(colors: [.clear, Color(hex: 0x0A0A0C, alpha: 0.92)], startPoint: UnitPoint(x: 0.5, y: 0.3), endPoint: .bottom)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(c.m1).font(prefs.verseFont(14)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                                Text(library.nick(p.poet)).font(.ui(11)).foregroundStyle(Palette.softText)
                            }
                            .padding(10)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Palette.line, lineWidth: 1))
            }
            .buttonStyle(PressStyle())
            .contextMenu {
                Button(role: .destructive) { prefs.toggleSave(ref) } label: { Label("برداشتن از دیوان", systemImage: "heart.slash") }
                Button { router.show(.share(ref.url, ref.index)) } label: { Label("استوری", systemImage: "square.and.arrow.up") }
            }
        }
    }
}
