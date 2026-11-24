import SwiftUI

/// حریم خصوصی: who sees what and who may reach me. Kept on the phone and, with an account, on the server.
struct PrivacyScreen: View {
    @Environment(PrivacyStore.self) private var privacy

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                section("دوستات چی ببینن") {
                    choice("بیت‌هایی که نگه می‌دارم", \.keptVisibility, [(.friends, "دوستا"), (.me, "فقط من")], id: "kept")
                    divider
                    choice("نتیجه‌ی معمای روز", \.dailyVisibility, [(.friends, "دوستا"), (.me, "فقط من")], id: "daily")
                    divider
                    toggle("آنلاین بودنم", \.showOnline, id: "online")
                    divider
                    toggle("اسمم توی رده‌بندیِ همه", \.inGlobalLeaderboard, note: "توی لیگ خودت همیشه دیده می‌شی", id: "leaderboard")
                }
                section("کی می‌تونه…") {
                    choice("بهم پیام بده", \.messagesFrom, [(.all, "همه"), (.friends, "دوستا")], id: "messages")
                    divider
                    choice("دعوتم کنه به بازی", \.gameInvitesFrom, [(.all, "همه"), (.friends, "دوستا")], id: "invites")
                }
                section("بازنشر") {
                    toggle("دوستام بتونن بیت‌هایی که می‌فرستم رو بازنشر کنن", \.allowReposts, id: "reposts")
                }
                note
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { header }
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task { await privacy.refresh() }
    }

    private var header: some View {
        HStack(spacing: 12) {
            BackButton()
            VStack(alignment: .leading, spacing: 0) {
                Text("حریم خصوصی").font(.title(30)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                Text("خودت انتخاب کن کی چی ببینه.").font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
            }
            Spacer(minLength: 0)
        }
    }

    private var divider: some View { Tokens.Colors.chipBorder.frame(height: 1) }

    private func section(_ title: String, @ViewBuilder rows: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).padding(.top, 4).padding(.bottom, 2)
                .accessibilityAddTraits(.isHeader)
            rows()
        }
        .padding(EdgeInsets(top: 10, leading: 16, bottom: 4, trailing: 16))
        .frame(maxWidth: .infinity, alignment: .leading)
        .meCard()
    }

    private func choice<Value: Hashable>(
        _ title: String, _ keyPath: WritableKeyPath<PrivacySettings, Value>, _ options: [(Value, String)], id: String
    ) -> some View {
        HStack(spacing: 10) {
            Text(title).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
            Spacer(minLength: 0)
            SegmentedControl(
                options: options, selection: Binding(get: { privacy.settings[keyPath: keyPath] }, set: { privacy.set(keyPath, to: $0) }),
                style: .pill, label: title, idPrefix: "privacy-\(id)"
            )
            .fixedSize()
        }
        .padding(.vertical, 12)
    }

    private func toggle(_ title: String, _ keyPath: WritableKeyPath<PrivacySettings, Bool>, note: String? = nil, id: String) -> some View {
        Toggle(isOn: Binding(get: { privacy.settings[keyPath: keyPath] }, set: { privacy.set(keyPath, to: $0) })) {
            VStack(alignment: .leading, spacing: 0) {
                Text(title).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink).multilineTextAlignment(.leading)
                if let note { Text(note).font(.ui(12)).foregroundStyle(Tokens.Colors.muted) }
            }
        }
        .toggleStyle(MeSwitchStyle())
        .padding(.vertical, 12)
        .accessibilityIdentifier("privacy-\(id)")
    }

    private var note: some View {
        HStack(spacing: 12) {
            LineIcon(shape: LockIcon(), size: 18, lineWidth: 2.4, fill: nil).foregroundStyle(Tokens.Colors.ink)
                .frame(width: 40, height: 40)
                .background(Circle().fill(Tokens.Colors.amber))
                .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                .stickerShadow(ShadowToken(y: 2, blur: 6, opacity: 0.22))
                .tilted(-8)
            Text("بیت‌هایی که نگه می‌داری رو فقط دوستات می‌بینن، اگه بخوای.")
                .font(.ui(13)).foregroundStyle(Tokens.Colors.ink).lineSpacing(5)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .meCard()
        .accessibilityElement(children: .combine)
    }
}
