import SwiftUI
import AuthenticationServices

/// Sign in / account card at the top of «من».
struct AccountSection: View {
    @Environment(Account.self) private var account
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router
    @State private var confirmDelete = false
    @State private var disconnecting: String?

    var body: some View {
        Group {
            if account.phase == .signedIn, let u = account.user { signedIn(u) } else { signedOut }
        }
        .confirmationDialog("این روش ورود قطع بشه؟", isPresented: Binding(get: { disconnecting != nil }, set: { if !$0 { disconnecting = nil } }), titleVisibility: .visible) {
            Button("قطع اتصال", role: .destructive) {
                if let p = disconnecting { Task { await account.disconnect(p) } }
                disconnecting = nil
            }
            Button("نه", role: .cancel) { disconnecting = nil }
        } message: {
            Text("حسابت و دیوانت سر جاش می‌مونه؛ فقط دیگه با این روش نمی‌تونی وارد شی.")
        }
        .confirmationDialog("حسابت پاک بشه؟", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("حذف حساب", role: .destructive) {
                Task { if await account.deleteAccount() { router.say("حسابت پاک شد") } }
            }
            Button("نه", role: .cancel) {}
        } message: {
            Text("همه‌ی چیزهایی که روی سرور یه بیت ذخیره شده پاک می‌شه. دیوانت روی همین گوشی می‌مونه.")
        }
    }

    private var signedOut: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("دیوانت رو همه‌جا داشته باش").font(.ui(16, .bold))
                Text("با ورود، بیت‌هایی که نگه داشتی و جایی که خوندی روی همه‌ی گوشی‌هات می‌مونه. ورود اختیاریه.")
                    .font(.ui(13)).foregroundStyle(Palette.muted).lineSpacing(5).fixedSize(horizontal: false, vertical: true)
            }
            SignInButtons()
        }
        .card()
    }

    private func signedIn(_ u: Account.User) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Text(String((u.name?.isEmpty == false ? u.name! : u.email ?? "ب").prefix(1)).uppercased())
                    .font(.ui(18, .bold)).foregroundStyle(prefs.onAccent)
                    .frame(width: 44, height: 44).background(Circle().fill(prefs.accent))
                VStack(alignment: .leading, spacing: 2) {
                    Text(u.name?.isEmpty == false ? u.name! : "حساب یه بیت").font(.ui(15, .bold)).lineLimit(1)
                    Text(syncLine(u)).font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(1)
                }
                Spacer()
                Button { Task { await account.sync() } } label: {
                    Image(systemName: "arrow.triangle.2.circlepath").font(.system(size: 15)).foregroundStyle(Palette.muted)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(PressStyle(scale: 0.9))
                .accessibilityLabel("همگام‌سازی")
            }
            VStack(alignment: .leading, spacing: 0) {
                Text("روش‌های ورود").font(.ui(12, .bold)).foregroundStyle(Palette.muted).padding(.bottom, 4)
                methodRow("apple", title: "اپل", icon: "apple.logo")
                if account.googleAvailable || account.isConnected("google") {
                    Divider().overlay(Palette.line)
                    methodRow("google", title: "گوگل", icon: nil)
                }
            }
            HStack(spacing: 10) {
                PillButton(title: "خروج", kind: .plain, grow: true) { account.signOut() }
                PillButton(title: "حذف حساب", kind: .ghost, grow: true) { confirmDelete = true }
            }
            if let e = account.error { Text(e).font(.ui(12)).foregroundStyle(Color(hex: 0xF06A7A)) }
        }
        .card()
    }

    @ViewBuilder private func methodRow(_ provider: String, title: String, icon: String?) -> some View {
        let id = account.identities.first { $0.provider == provider }
        HStack(spacing: 12) {
            Group {
                if let icon { Image(systemName: icon).font(.system(size: 17)).foregroundStyle(Palette.ink) }
                else { GoogleMark().frame(width: 17, height: 17) }
            }
            .frame(width: 34, height: 34)
            .background(Circle().fill(Palette.sunk))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.ui(14, .bold))
                Text(id.map { $0.email ?? "وصل شده" } ?? "وصل نیست").font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(1)
            }
            Spacer()
            if id == nil {
                Button("وصل کردن") {
                    Task { if await account.connect(provider) { router.say(title + " وصل شد") } }
                }
                .font(.ui(13, .bold)).foregroundStyle(prefs.accent)
                .disabled(account.phase == .working)
            } else if account.identities.count > 1 {
                Button("قطع") { disconnecting = provider }
                    .font(.ui(13, .medium)).foregroundStyle(Palette.muted)
            } else {
                LineIcon(name: "check", size: 18).foregroundStyle(Palette.good)
            }
        }
        .padding(.vertical, 8)
    }

    private func syncLine(_ u: Account.User) -> String {
        let who = u.email ?? ""
        guard let t = account.lastSync else { return who.isEmpty ? "وارد شدی" : who }
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "fa_IR")
        f.unitsStyle = .short
        let when = Date.now.timeIntervalSince(t) < 30 ? "همین الان" : f.localizedString(for: t, relativeTo: .now)
        return (who.isEmpty ? "" : who + " · ") + "همگام شد " + when
    }
}

/// Google "G" in its four brand colours, drawn so we don't need an image asset.
struct GoogleMark: View {
    var body: some View {
        GeometryReader { g in
            let w = min(g.size.width, g.size.height), lw = w * 0.2
            ZStack {
                arc(-45, 45, lw).stroke(Color(hex: 0x4285F4), style: StrokeStyle(lineWidth: lw))
                arc(45, 135, lw).stroke(Color(hex: 0x34A853), style: StrokeStyle(lineWidth: lw))
                arc(135, 200, lw).stroke(Color(hex: 0xFBBC05), style: StrokeStyle(lineWidth: lw))
                arc(200, 315, lw).stroke(Color(hex: 0xEA4335), style: StrokeStyle(lineWidth: lw))
                Rectangle().fill(Color(hex: 0x4285F4)).frame(width: w * 0.45, height: lw).offset(x: w * 0.2)
            }
            .frame(width: w, height: w)
        }
        .environment(\.layoutDirection, .leftToRight)
    }
    private func arc(_ a: Double, _ b: Double, _ lw: CGFloat) -> some Shape {
        ArcShape(start: .degrees(a), end: .degrees(b), inset: lw / 2)
    }
}

private struct ArcShape: Shape {
    let start: Angle, end: Angle, inset: CGFloat
    func path(in r: CGRect) -> Path {
        Path { p in p.addArc(center: CGPoint(x: r.midX, y: r.midY), radius: min(r.width, r.height) / 2 - inset, startAngle: start, endAngle: end, clockwise: false) }
    }
}

/// Sign in with Apple and Google buttons (used in «من» and onboarding).
struct SignInButtons: View {
    var onSignedIn: (() -> Void)? = nil
    @Environment(Account.self) private var account

    var body: some View {
        VStack(spacing: 10) {
            // Our own Apple button: Apple's system button has no Persian version.
            // Kept to Apple's guidelines: Apple logo, white, same size and shape as the system button.
            Button { Task { await account.signInWithApple(); if account.phase == .signedIn { onSignedIn?() } } } label: {
                HStack(spacing: 8) {
                    Image(systemName: "apple.logo").font(.system(size: 19, weight: .medium)).offset(y: -1)
                    Text("ورود با اپل").font(.system(size: 17, weight: .medium))
                }
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity).frame(height: 48)
                .background(Capsule().fill(.white))
            }
            .buttonStyle(PressStyle())
            .disabled(account.phase == .working)
            .accessibilityLabel("ورود با اپل")
            if account.googleAvailable {
                Button { Task { await account.signInWithGoogle(); if account.phase == .signedIn { onSignedIn?() } } } label: {
                    HStack(spacing: 10) {
                        GoogleMark().frame(width: 18, height: 18)
                        Text("ورود با گوگل").font(.system(size: 17, weight: .medium))
                    }
                    .foregroundStyle(Color(hex: 0x1F1F1F))
                    .frame(maxWidth: .infinity).frame(height: 48)
                    .background(Capsule().fill(.white))
                }
                .buttonStyle(PressStyle())
                .disabled(account.phase == .working)
            }
            if account.phase == .working { ProgressView().frame(maxWidth: .infinity) }
            if let e = account.error { Text(e).font(.ui(12)).foregroundStyle(Color(hex: 0xF06A7A)).frame(maxWidth: .infinity, alignment: .leading) }
        }
    }
}
