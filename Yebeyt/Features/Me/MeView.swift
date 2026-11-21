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
                AccountSection()
                HStack(spacing: 10) {
                    stat(prefs.readCount, "بیت خوندی")
                    stat(prefs.streak, "روز پشتِ هم")
                    Button { router.open(.saved) } label: { stat(prefs.saved.count, "نگه داشتی") }.buttonStyle(PressStyle())
                }
                VStack(alignment: .leading, spacing: 4) {
                    SectionTitle(title: "نگه‌داشته‌ها") {
                        if prefs.saved.count > 3 {
                            Button("همه · \(prefs.saved.count.fa)") { router.open(.saved) }.font(.ui(13, .bold)).foregroundStyle(prefs.accent)
                        }
                    }
                    if prefs.saved.isEmpty {
                        EmptyNote(text: "هنوز چیزی نگه نداشتی.\nکارت‌ها رو به راست بکش تا اینجا بیان.").padding(.top, 6)
                    } else {
                        ForEach(prefs.saved.prefix(3)) { r in
                            SavedRow(ref: r).padding(.vertical, 10)
                                .overlay(alignment: .bottom) { Rectangle().fill(Palette.line).frame(height: 1) }
                        }
                        if prefs.saved.count > 3 {
                            Button { router.open(.saved) } label: {
                                HStack {
                                    Text("دیدن همه‌ی \(prefs.saved.count.fa) بیت").font(.ui(15, .medium))
                                    Spacer()
                                    LineIcon(name: "fwd", size: 18).foregroundStyle(Palette.muted)
                                }
                                .foregroundStyle(Palette.ink).padding(.vertical, 14).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
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
                Text("یه بیت · نسخه‌ی \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")".fa)
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
