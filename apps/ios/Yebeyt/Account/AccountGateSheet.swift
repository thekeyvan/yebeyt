import SwiftUI

/// AccountGate: the sheet over the current screen that asks for an account the first time a feature needs one.
/// It is reusable: give it the feature's title («پسند و بازنشر», «پیام دادن به دوستات»).
struct AccountGateSheet: View {
    let feature: AccountFeature
    let busy: Bool
    let error: String?
    let signIn: (AuthProvider) -> Void
    let later: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                icon
                Text("برای \(feature.title)\nیه حساب لازمه")
                    .font(.title(24)).lineSpacing(-6).foregroundStyle(Tokens.Colors.ink)
                    .padding(.top, 3)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("gateTitle")
                Spacer(minLength: 0)
            }
            Text("با اپل یا گوگل، چند ثانیه طول می‌کشه. هر چی تا الان جمع کردی (امتیاز، دیوان، رشته‌ی روزها) هم منتقل می‌شه.")
                .font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineSpacing(5)
                .frame(maxWidth: .infinity, alignment: .leading)
            SignInButtons(busy: busy, error: error, signIn: signIn)
            Button(action: later) {
                Text("بعداً").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
                    .padding(.top, 4).frame(maxWidth: .infinity, minHeight: 36)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("gateLater")
        }
        .padding(EdgeInsets(top: 22, leading: 22, bottom: 8, trailing: 22))
    }

    @ViewBuilder private var icon: some View {
        switch feature {
        case .likes:
            Circle().fill(Tokens.Colors.magenta)
                .overlay { LineIcon(shape: HeartIcon(), size: 26, lineWidth: 2.2, fill: Tokens.Colors.white).foregroundStyle(Tokens.Colors.white) }
                .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 4))
                .shadow(color: Tokens.Colors.ink.opacity(0.2), radius: 3, x: 0, y: 2)
                .frame(width: 54, height: 54)
                .accessibilityHidden(true)
        case .messages, .invite, .games:
            GameIcon(kind: .mosh, size: 54)
        case .profile, .leaderboard:
            Circle().fill(Tokens.Colors.lapis)
                .overlay { AvatarView(parts: .standard).padding(5) }
                .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 4))
                .shadow(color: Tokens.Colors.ink.opacity(0.2), radius: 3, x: 0, y: 2)
                .frame(width: 54, height: 54)
                .accessibilityHidden(true)
        }
    }
}

/// What the account sheet shows: the gate, or the username step after a sign-in that leaves no username.
struct AccountPromptSheet: View {
    @Environment(AccountModel.self) private var account
    @State private var error: String?
    @State private var gateHeight: CGFloat = 400

    var body: some View {
        Group {
            switch account.prompt {
            case .gate(let feature):
                AccountGateSheet(
                    feature: feature, busy: account.isSigningIn, error: error,
                    signIn: { provider in
                        error = nil
                        Task { error = await account.signInFromGate(with: provider) }
                    },
                    later: { account.dismissPrompt() }
                )
                .fixedSize(horizontal: false, vertical: true)  // its own height, so measuring it does not depend on the sheet's
                .background { GeometryReader { Color.clear.preference(key: SheetHeight.self, value: $0.size.height) } }
                .onPreferenceChange(SheetHeight.self) { gateHeight = $0 }
                .presentationDetents([.height(gateHeight)])
            case .username:
                UsernameStep(account: account, onSaved: { account.finishPrompt() })
                    .presentationDetents([.large])
            case nil:
                EmptyView()
            }
        }
        .presentationBackground(Tokens.Colors.white)
        .presentationCornerRadius(30)
        .presentationDragIndicator(.visible)
        .environment(\.layoutDirection, .rightToLeft)
        .accessibilityElement(children: .contain)
    }
}

private struct SheetHeight: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

extension View {
    /// Shows the account sheet over this view while `AccountModel.prompt` is set. A screen presented over the
    /// tabs (the reader) hosts its own; the tabs host it only while nothing covers them.
    func accountPrompt(host: Bool) -> some View {
        modifier(AccountPromptHost(host: host))
    }
}

private struct AccountPromptHost: ViewModifier {
    @Environment(AccountModel.self) private var account
    let host: Bool

    func body(content: Content) -> some View {
        content.sheet(isPresented: Binding(
            get: { host && account.prompt != nil },
            set: { if !$0 { account.dismissPrompt() } }
        )) {
            AccountPromptSheet()
        }
    }
}
