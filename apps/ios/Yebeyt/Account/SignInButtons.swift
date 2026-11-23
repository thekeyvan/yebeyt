import SwiftUI

/// The Apple and Google marks of the sign-in buttons, drawn from the boards' SVG paths (24×24 box). They are the
/// only brand art in the app.
struct AppleMark: View {
    var size: CGFloat = 20
    var color = Tokens.Colors.white

    var body: some View {
        SVGShape(d: "M16.37 12.6c-.02-2.07 1.69-3.07 1.77-3.12-.96-1.41-2.46-1.6-3-1.62-1.27-.13-2.49.75-3.13.75-.65 0-1.65-.73-2.71-.71-1.39.02-2.68.81-3.4 2.06-1.45 2.52-.37 6.25 1.04 8.29.69 1 1.51 2.12 2.59 2.08 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.71.65 1.12-.02 1.83-1.02 2.51-2.02.79-1.16 1.12-2.28 1.14-2.34-.03-.01-2.18-.84-2.21-3.35zM14.3 6.5c.57-.69.96-1.65.85-2.6-.82.03-1.82.55-2.41 1.24-.53.61-.99 1.59-.87 2.53.92.07 1.85-.47 2.43-1.17z")
            .fill(color)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

struct GoogleMark: View {
    var size: CGFloat = 20

    var body: some View {
        ZStack {
            SVGShape(d: "M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.9c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z").fill(Color(hex: 0x4285F4))
            SVGShape(d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z").fill(Color(hex: 0x34A853))
            SVGShape(d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z").fill(Color(hex: 0xFBBC05))
            SVGShape(d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z").fill(Color(hex: 0xEA4335))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// «ادامه با اپل» and «ادامه با گوگل», with the line that says why a sign-in failed.
struct SignInButtons: View {
    let busy: Bool
    let error: String?
    let signIn: (AuthProvider) -> Void

    var body: some View {
        VStack(spacing: 10) {
            button("ادامه با اپل", provider: .apple, fill: .black, text: Tokens.Colors.white, id: "signInApple") { AppleMark() }
            button("ادامه با گوگل", provider: .google, fill: Tokens.Colors.white, text: Tokens.Colors.ink, id: "signInGoogle") { GoogleMark() }
                .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(Color(hex: 0xDADCE0), lineWidth: 1.5) }
            if let error {
                Text(error).font(.ui(12, weight: .medium)).foregroundStyle(Tokens.Colors.fire).multilineTextAlignment(.center)
                    .accessibilityIdentifier("signInError")
            }
        }
        .disabled(busy)
        .opacity(busy ? 0.6 : 1)
    }

    private func button(_ title: String, provider: AuthProvider, fill: Color, text: Color, id: String, @ViewBuilder mark: () -> some View) -> some View {
        Button { signIn(provider) } label: {
            HStack(spacing: 10) {
                mark()
                Text(title).font(.ui(16, weight: .bold))
            }
            .foregroundStyle(text)
            .frame(maxWidth: .infinity, minHeight: 54, maxHeight: 54)
            .background(RoundedRectangle(cornerRadius: 16).fill(fill))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}
