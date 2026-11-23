import SwiftUI

/// OnbAccount: «امتیازت رو نگه داریم؟» with what an account gives, Apple and Google, and «فعلاً بدون حساب».
/// «آفرین! +۵۰» shows when the first game was won.
struct OnbAccountView: View {
    @Environment(OnboardingModel.self) private var onboarding
    @Environment(AccountModel.self) private var account
    @State private var error: String?

    var body: some View {
        VStack(spacing: 16) {
            OnbTopBar(current: 2) { onboarding.finish() }
            header
            benefits
            Spacer(minLength: 0)
            VStack(spacing: 10) {
                SignInButtons(busy: account.isSigningIn, error: error) { provider in
                    error = nil
                    Task { await signIn(provider) }
                }
                Button { onboarding.finish() } label: {
                    Text("فعلاً بدون حساب").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
                        .padding(.top, 8).frame(maxWidth: .infinity, minHeight: 36)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("onbNoAccount")
                terms
            }
        }
        .onbPage()
    }

    private func signIn(_ provider: AuthProvider) async {
        switch await account.signIn(with: provider) {
        case .signedIn(let needsUsername): onboarding.signedIn(needsUsername: needsUsername)
        case .canceled: break
        case .failed(let message): error = message
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            if onboarding.gameWon {
                Text("آفرین! +\(PersianDigits.string(OnboardingGame.reward))")
                    .font(.title(30)).foregroundStyle(Tokens.Colors.ink)
                    .padding(EdgeInsets(top: 8, leading: 20, bottom: 3, trailing: 20))
                    .sticker(fill: Tokens.Colors.amber, radius: Tokens.Sticker.Radius.pill, border: 5, shadow: ShadowToken(y: 4, blur: 12, opacity: 0.2))
                    .tilted(-4)
                    .accessibilityIdentifier("onbReward")
            }
            Text("امتیازت رو نگه داریم؟").font(.title(30)).foregroundStyle(Tokens.Colors.ink).padding(.top, 6)
                .accessibilityAddTraits(.isHeader)
            Text("با یه حساب، هر چی جمع می‌کنی مال خودت می‌مونه،\nروی هر گوشی‌ای.")
                .font(.ui(13)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center).lineSpacing(5)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 6)
    }

    private var benefits: some View {
        VStack(spacing: 12) {
            row("امتیاز، رشته‌ی روزها و رده‌بندی") {
                badge(Tokens.Colors.amber) { StarShape().fill(Tokens.Colors.ink).frame(width: 18, height: 18) }
            }
            row("مشاعره و بازی با دوستات") { GameIcon(kind: .mosh, size: 38) }
            row("دیوانت روی همه‌ی گوشی‌هات") {
                badge(Tokens.Colors.lapis) { BookmarkIcon().fill(Tokens.Colors.white).frame(width: 17, height: 17) }
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .background { RoundedRectangle(cornerRadius: 24).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 11, x: 0, y: 6) }
    }

    private func row(_ text: String, @ViewBuilder icon: () -> some View) -> some View {
        HStack(spacing: 12) {
            icon()
            Text(text).font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
            Spacer(minLength: 0)
        }
    }

    /// A 38pt sticker circle with a white border.
    private func badge(_ fill: Color, @ViewBuilder content: () -> some View) -> some View {
        Circle().fill(fill)
            .overlay { content() }
            .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
            .frame(width: 38, height: 38)
            .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 3, x: 0, y: 2)
    }

    private var terms: some View {
        Text(Self.termsText)
            .font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698)).multilineTextAlignment(.center).lineSpacing(4)
            .tint(Tokens.Colors.lapis)
    }

    static let termsURL = URL(string: "https://yebeyt.com/terms")!
    static let privacyURL = URL(string: "https://yebeyt.com/privacy")!

    private static var termsText: AttributedString {
        var text = AttributedString("با ادامه، ")
        var terms = AttributedString("شرایط استفاده")
        terms.link = termsURL
        var privacy = AttributedString("حریم خصوصی")
        privacy.link = privacyURL
        text += terms
        text += AttributedString(" و ")
        text += privacy
        text += AttributedString(" رو قبول می‌کنی.\nایمیلت رو به هیچ‌کس نشون نمی‌دیم.")
        return text
    }
}
