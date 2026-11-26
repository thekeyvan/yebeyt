import SwiftUI

/// OnbWelcome: the name, the promise, «بزن بریم», and a way in for people who already have an account.
struct OnbWelcomeView: View {
    @Environment(OnboardingModel.self) private var onboarding
    @Environment(Library.self) private var library

    var body: some View {
        OnbScreen {
            HStack {
                Button("از قبل حساب داری؟ وارد شو") { onboarding.signIn() }
                    .font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("onbHaveAccount")
                Spacer()
            }
        } content: { density in
            hero(minHeight: density.room)
        } footer: {
            VStack(spacing: 10) {
                Button("بزن بریم") { onboarding.next() }
                    .buttonStyle(OnbButtonStyle())
                    .accessibilityIdentifier("onbStart")
                Text("بدون حساب هم می‌شه شروع کرد").font(.ui(12)).foregroundStyle(Color(hex: 0x8A8698))
            }
        }
    }

    private func hero(minHeight: CGFloat) -> some View {
        ZStack {
            VStack(spacing: 18) {
                cards
                Text("یه بیت").font(.title(64)).foregroundStyle(Tokens.Colors.ink).padding(.top, 10)
                    .accessibilityAddTraits(.isHeader)
                Text("هر بیت، یه بازی.").font(.ui(18, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                Text("هر روز یه بیت برای تو، بازی با شعر،\nو مشاعره با دوستات.")
                    .font(.ui(14)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center).lineSpacing(5)
            }
            decorations
        }
        .frame(maxWidth: .infinity, minHeight: minHeight)
    }

    /// Two stickers, one blue and one orange, each with a white bar.
    private var cards: some View {
        HStack(spacing: 10) {
            card(Tokens.Colors.lapis)
            card(Tokens.Colors.fire).tilted(10).offset(y: 6)
        }
        .tilted(-6)
        .accessibilityHidden(true)
    }

    private func card(_ color: Color) -> some View {
        Capsule().fill(Tokens.Colors.white).frame(width: 34, height: 9)
            .frame(width: 58, height: 88)
            .sticker(fill: color, radius: 18, border: 6, shadow: ShadowToken(y: 6, blur: 16, opacity: 0.22))
    }

    /// Three loose stickers around the middle: a couplet, a poet and the game.
    private var decorations: some View {
        ZStack {
            Text("الا یا ایها الساقی\nادر کأسا و ناولها")
                .font(.poem(14)).lineSpacing(4).foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .sticker(fill: Tokens.Colors.white, radius: 18, border: 4, shadow: ShadowToken(y: 4, blur: 12, opacity: 0.14))
                .tilted(5)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.top, 20)
            GameIcon(kind: .jigsaw, size: 56)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(.top, 60).padding(.trailing, 10)
            if let hafez = library.poet(slug: "hafez") {
                PoetCircle(poet: hafez, size: 64, border: 4)
                    .tilted(-8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(.bottom, 40)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
