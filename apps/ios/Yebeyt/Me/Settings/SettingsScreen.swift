import SwiftUI

/// تنظیمات (no board): a plain list in the app's card style. The account (name, username, sign out, delete), the
/// text sheet, privacy, and about. A guest sees «ورود با اپل یا گوگل» instead of the account rows.
struct SettingsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session
    @Environment(AccountModel.self) private var account
    @State private var editingProfile = false
    @State private var textOpen = false
    @State private var confirmingDelete = false

    static let termsURL = URL(string: "https://yebeyt.com/terms")!
    static let privacyURL = URL(string: "https://yebeyt.com/privacy")!

    /// «نسخه‌ی ۲.۰.۰»
    static func versionLine(bundle: Bundle = .main) -> String {
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "2.0.0"
        return "نسخه‌ی \(PersianDigits.convert(version))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: "تنظیمات")
                accountCard
                card {
                    row("متن", id: "settingsText") { textOpen = true }
                    divider
                    row("حریم خصوصی", id: "settingsPrivacy") { model.mePath.append(.privacy) }
                }
                aboutCard
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $editingProfile) {
            UsernameStep(account: account, onSaved: { editingProfile = false })
                .presentationDetents([.large])
                .presentationBackground(Tokens.Colors.white)
                .presentationCornerRadius(30)
                .presentationDragIndicator(.visible)
                .environment(\.layoutDirection, .rightToLeft)
        }
        .sheet(isPresented: $textOpen) {
            TextSheet { textOpen = false }
                .presentationDetents([.large])
                .presentationBackground(Tokens.Colors.white)
                .presentationDragIndicator(.hidden)
                .environment(\.layoutDirection, .rightToLeft)
        }
        .sheet(isPresented: $confirmingDelete) { DeleteAccountSheet(isPresented: $confirmingDelete) }
    }

    // MARK: Cards

    @ViewBuilder private var accountCard: some View {
        if session.isSignedIn {
            card(title: "حساب") {
                row("اسم", value: session.user?.displayName ?? account.providerName ?? "", id: "settingsName") { editingProfile = true }
                divider
                row("نام کاربری", value: session.user?.username.map { "@\($0)" } ?? "", id: "settingsUsername", valueIsLatin: true) { editingProfile = true }
                divider
                row("خروج از حساب", id: "signOut", chevron: false) { Task { await session.signOut() } }
                divider
                row("پاک کردن حساب", id: "deleteAccount", chevron: false, tint: Tokens.Colors.fire) { confirmingDelete = true }
            }
        } else {
            card {
                row("ورود با اپل یا گوگل", id: "settingsSignIn") { account.require(.profile) {} }
            }
        }
    }

    private var aboutCard: some View {
        card(title: "درباره") {
            HStack {
                Text(Self.versionLine()).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                Spacer()
            }
            .padding(.vertical, 13)
            .accessibilityIdentifier("version")
            divider
            linkRow("شرایط استفاده", Self.termsURL, id: "terms")
            divider
            linkRow("حریم خصوصی", Self.privacyURL, id: "privacyPolicy")
            divider
            row("مجوزها", id: "licenses") { model.mePath.append(.licenses) }
        }
    }

    private var divider: some View { Tokens.Colors.chipBorder.frame(height: 1) }

    private func card(title: String? = nil, @ViewBuilder rows: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title {
                Text(title).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).padding(.top, 4)
                    .accessibilityAddTraits(.isHeader)
            }
            rows()
        }
        .padding(EdgeInsets(top: 10, leading: 16, bottom: 4, trailing: 16))
        .frame(maxWidth: .infinity, alignment: .leading)
        .meCard()
    }

    private func row(
        _ title: String, value: String = "", id: String, chevron: Bool = true, tint: Color = Tokens.Colors.ink,
        valueIsLatin: Bool = false, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title).font(.ui(14, weight: .medium)).foregroundStyle(tint)
                Spacer(minLength: 8)
                if !value.isEmpty {
                    Text(value).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineLimit(1)
                        .environment(\.layoutDirection, valueIsLatin ? .leftToRight : .rightToLeft)
                }
                if chevron { LineIcon(shape: ChevronLeftIcon(), size: 18, lineWidth: 2.4, fill: nil).foregroundStyle(Tokens.Colors.muted) }
            }
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private func linkRow(_ title: String, _ url: URL, id: String) -> some View {
        Link(destination: url) {
            HStack {
                Text(title).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                Spacer()
                LineIcon(shape: ChevronLeftIcon(), size: 18, lineWidth: 2.4, fill: nil).foregroundStyle(Tokens.Colors.muted)
            }
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .accessibilityIdentifier(id)
    }
}

/// «حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟» with «پاک کن» and «نه».
struct DeleteAccountSheet: View {
    @Environment(Session.self) private var session
    @Environment(ReaderMarks.self) private var marks
    @Environment(PrivacyStore.self) private var privacy
    @Environment(AvatarStore.self) private var avatar
    @Binding var isPresented: Bool
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 16) {
            Text("حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟")
                .font(.title(22)).lineSpacing(-2).multilineTextAlignment(.center).foregroundStyle(Tokens.Colors.ink)
                .accessibilityIdentifier("deleteTitle")
            if let error {
                Text(error).font(.ui(13, weight: .medium)).foregroundStyle(Tokens.Colors.fire).multilineTextAlignment(.center)
                    .accessibilityIdentifier("deleteError")
            }
            HStack(spacing: 12) {
                Button { isPresented = false } label: {
                    Text("نه").frame(maxWidth: .infinity)
                }
                .buttonStyle(.sticker(.secondary))
                .accessibilityIdentifier("deleteCancel")
                Button(action: delete) {
                    Text("پاک کن").frame(maxWidth: .infinity)
                }
                .buttonStyle(DangerButtonStyle())
                .disabled(busy)
                .accessibilityIdentifier("deleteConfirm")
            }
        }
        .padding(EdgeInsets(top: 28, leading: 22, bottom: 16, trailing: 22))
        .presentationDetents([.height(260)])
        .presentationBackground(Tokens.Colors.white)
        .presentationCornerRadius(30)
        .presentationDragIndicator(.visible)
        .environment(\.layoutDirection, .rightToLeft)
    }

    private func delete() {
        busy = true
        error = nil
        Task {
            let deletion = AccountDeletion(session: session, marks: marks, privacy: privacy, avatar: avatar)
            error = await deletion.delete()
            busy = false
            if error == nil { isPresented = false }
        }
    }
}

/// «پاک کن»: the primary button in fire.
struct DangerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title(21))
            .foregroundStyle(Tokens.Colors.white)
            .padding(EdgeInsets(top: 9, leading: 22, bottom: 5, trailing: 22))
            .sticker(fill: Tokens.Colors.fire, radius: Tokens.Sticker.Radius.button, border: Tokens.Sticker.BorderWidth.button, shadow: Tokens.Sticker.Shadow.button)
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

/// مجوزها: the fonts, the poetry and the libraries the app uses, from THIRD_PARTY_NOTICES.md.
struct LicensesScreen: View {
    private struct Credit: Identifiable {
        let id: String
        let name: String
        let by: String
        let license: String
    }

    private struct CreditGroup: Identifiable {
        let id: String
        let credits: [Credit]
    }

    private static let groups = [
        CreditGroup(id: "قلم‌ها", credits: [
            Credit(id: "parastoo", name: "Parastoo, Gandom, Sahel, Shabnam", by: "Saber Rastikerdar", license: "SIL Open Font License 1.1"),
            Credit(id: "vazirmatn", name: "Vazirmatn", by: "The Vazirmatn Project Authors", license: "SIL Open Font License 1.1"),
            Credit(id: "lalezar", name: "Lalezar", by: "Borna Izadpanah", license: "SIL Open Font License 1.1"),
            Credit(id: "markazi", name: "Markazi Text", by: "The Markazi Text Project Authors", license: "SIL Open Font License 1.1"),
            Credit(id: "noto", name: "Noto Naskh Arabic, Noto Nastaliq Urdu", by: "The Noto Project Authors", license: "SIL Open Font License 1.1"),
        ]),
        CreditGroup(id: "شعر، معنی‌ها و خوانش‌ها", credits: [
            Credit(id: "ganjoor", name: "Ganjoor (ganjoor.net)", by: "Poems, meanings, summaries, biographies and recitations, through ganjoor's public repositories and API", license: "The classical poems are in the public domain"),
        ]),
        CreditGroup(id: "کتابخونه‌ها", credits: [
            Credit(id: "google", name: "GoogleSignIn-iOS and its dependencies", by: "Google", license: "Apache License 2.0"),
        ]),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: "مجوزها")
                ForEach(Self.groups) { group in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(group.id).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).padding(.top, 4).padding(.bottom, 6)
                            .accessibilityAddTraits(.isHeader)
                        ForEach(group.credits) { credit in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(credit.name).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                                Text(credit.by).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                                Text(credit.license).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                            }
                            .environment(\.layoutDirection, .leftToRight)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .padding(EdgeInsets(top: 10, leading: 16, bottom: 6, trailing: 16))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .meCard()
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }
}
