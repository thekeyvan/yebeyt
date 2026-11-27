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
    @Environment(ReactionsSync.self) private var reactions
    @Environment(ScoreSync.self) private var scores
    @Environment(GameStats.self) private var gameStats
    @Environment(FeedbackCenter.self) private var feedback
    @AppStorage(FeedbackSettings.shakeKey) private var shakeForFeedback = true
    @State private var editingProfile = false
    @State private var textOpen = false
    @State private var confirmingDelete = false
    @State private var askingSignOut = false
    /// «بیرون برو» was chosen; the sign-out starts once that sheet is gone, so the warning of an unsynced divan can follow it.
    @State private var signOutChosen = false
    @State private var confirmingSignOut = false
    @State private var signingOut = false
    @State private var savingNews = false

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
                accountCard
                card {
                    row("متن", id: "settingsText") { textOpen = true }
                    divider
                    row("حریم خصوصی", id: "settingsPrivacy") { model.mePath.append(.privacy) }
                    divider
                    Toggle(isOn: $shakeForFeedback) {
                        Text("تکون دادن برای بازخورد").font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                    }
                    .toggleStyle(MeSwitchStyle())
                    .padding(.vertical, 10)
                    .onChange(of: shakeForFeedback) { FeedbackSettings.applyShakeToEdit() }
                    .accessibilityIdentifier("settingsShake")
                }
                aboutCard
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .stickyHeader { ScreenHeader(title: "تنظیمات") }
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $editingProfile) {
            UsernameStep(account: account, onSaved: { editingProfile = false })
                .presentationDetents([.large])
                .stickerSheet()
                .environment(\.layoutDirection, .rightToLeft)
        }
        .sheet(isPresented: $textOpen) {
            TextSheet { textOpen = false }
        }
        .sheet(isPresented: $confirmingDelete) { DeleteAccountSheet(isPresented: $confirmingDelete) }
        .sheet(isPresented: $askingSignOut, onDismiss: {
            guard signOutChosen else { return }
            signOutChosen = false
            signOut()
        }) {
            ConfirmSheet(
                title: SignOutCopy.title, message: SignOutCopy.message, confirm: SignOutCopy.confirm, cancel: SignOutCopy.stay,
                prefix: "signOutAsk", isPresented: $askingSignOut
            ) { signOutChosen = true }
        }
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
                if let email = NewsChoice.emailLine(session.user?.email) {
                    divider
                    emailRow(email)
                    divider
                    newsRow
                }
                divider
                row("خروج از حساب", id: "signOut", chevron: false) { askingSignOut = true }
                divider
                row("پاک کردن حساب", id: "deleteAccount", chevron: false, tint: Tokens.Colors.fire) { confirmingDelete = true }
            }
        } else {
            card {
                row("ورود با اپل یا گوگل", id: "settingsSignIn") { account.require(.profile) {} }
            }
        }
    }

    /// «ایمیل»: the address (Latin, left to right), not a button.
    private func emailRow(_ line: String) -> some View {
        HStack(spacing: 8) {
            Text(NewsChoice.emailTitle).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
            Spacer(minLength: 8)
            Text(line).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineLimit(1).truncationMode(.middle)
                .feedbackPrivate()
                .environment(\.layoutDirection, line == NewsChoice.hiddenEmail ? .rightToLeft : .leftToRight)
        }
        .padding(.vertical, 13)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("settingsEmail")
    }

    /// The news switch with its muted line; it flips at once and goes back with a toast when the server says no.
    private var newsRow: some View {
        VStack(alignment: .leading, spacing: 2) {
            Toggle(isOn: Binding(get: { session.user?.newsOptIn ?? false }, set: changeNews)) {
                Text(NewsChoice.switchTitle).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
            }
            .toggleStyle(MeSwitchStyle())
            .disabled(savingNews)
            .accessibilityHint(NewsChoice.switchNote)
            .accessibilityIdentifier("settingsNews")
            Text(NewsChoice.switchNote).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                .accessibilityHidden(true)
                .accessibilityIdentifier("settingsNewsNote")
        }
        .padding(.vertical, 10)
    }

    private func changeNews(_ optIn: Bool) {
        savingNews = true
        Task {
            if let failure = await NewsChoice.set(optIn, session: session) { model.showToast(failure.persianMessage) }
            savingNews = false
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
            row("بازخورد", id: "settingsFeedback") { feedback.open(source: .settings) }
            divider
            row("مجوزها", id: "licenses") { model.mePath.append(.licenses) }
        }
    }

    private var divider: some View { Tokens.Colors.chipBorder.frame(height: 1) }

    private var leaving: AccountSignOut {
        AccountSignOut(session: session, data: LocalAccountData(marks: marks, privacy: privacy, avatar: avatar, reactions: reactions, scores: scores, stats: gameStats), divanSync: divanSync)
    }

    /// One last sync, then out; when it did not go through, the person is asked before anything is lost.
    private func signOut() {
        guard !signingOut else { return }
        signingOut = true
        let leaving = leaving
        Task {
            if await leaving.signOut() == .unsynced { confirmingSignOut = true }
            signingOut = false
        }
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
