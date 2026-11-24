import SwiftUI

/// تنظیمات (no board): a plain list in the app's card style. The account (name, username, sign out, delete), the
/// text sheet, privacy, and about. A guest sees «ورود با اپل یا گوگل» instead of the account rows.
struct SettingsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session
    @Environment(AccountModel.self) private var account
    @Environment(ReaderMarks.self) private var marks
    @Environment(PrivacyStore.self) private var privacy
    @Environment(AvatarStore.self) private var avatar
    @Environment(DivanSync.self) private var divanSync
    @State private var editingProfile = false
    @State private var textOpen = false
    @State private var confirmingDelete = false
    @State private var confirmingSignOut = false

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
        .sheet(isPresented: $confirmingSignOut) {
            UnsyncedSignOutSheet(isPresented: $confirmingSignOut) { await leaving.signOut(force: true) }
        }
    }

    // MARK: Cards

    @ViewBuilder private var accountCard: some View {
        if session.isSignedIn {
            card(title: "حساب") {
                row("اسم", value: session.user?.displayName ?? account.providerName ?? "", id: "settingsName") { editingProfile = true }
                divider
                row("نام کاربری", value: session.user?.username.map { "@\($0)" } ?? "", id: "settingsUsername", valueIsLatin: true) { editingProfile = true }
                divider
                row("خروج از حساب", id: "signOut", chevron: false) { signOut() }
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
            linkRow("سیاست حریم خصوصی", Self.privacyURL, id: "privacyPolicy")
            divider
            row("مجوزها", id: "licenses") { model.mePath.append(.licenses) }
        }
    }

    private var divider: some View { Tokens.Colors.chipBorder.frame(height: 1) }

    private var leaving: AccountSignOut {
        AccountSignOut(session: session, data: LocalAccountData(marks: marks, privacy: privacy, avatar: avatar), divanSync: divanSync)
    }

    /// One last sync, then out; when it did not go through, the person is asked before anything is lost.
    private func signOut() {
        let leaving = leaving
        Task { if await leaving.signOut() == .unsynced { confirmingSignOut = true } }
    }

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
