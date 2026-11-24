import SwiftUI

/// A person's face on a white-bordered round sticker, with the green dot when they are online.
struct Face: View {
    let parts: AvatarParts?
    var size: CGFloat = 52
    var border: CGFloat = 3
    var online = false

    var body: some View {
        // Left-to-right inside, so the dot's bottom-left corner is the board's (physical) one.
        ZStack(alignment: .bottomLeading) {
            Circle()
                .fill(Tokens.Colors.white)
                .overlay(AvatarView(parts: parts ?? .standard).padding(max(border - size * 0.02, 0)))
                .stickerShadow(ShadowToken(y: 1, blur: 8, opacity: 0.22))
            if online {
                Circle()
                    .fill(Tokens.Colors.green)
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .frame(width: 14, height: 14)
                    .offset(x: -2, y: 2)
                    .accessibilityHidden(true)
            }
        }
        .frame(width: size, height: size)
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityHidden(true)
    }
}

/// The two columns of the shared-divan icon (the board's book).
struct SharedDivanIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z").path(in: rect)
    }
}

/// A line that says something for a moment, over the bottom of a screen: ink capsule, white text.
struct MessageToast: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.ui(13, weight: .medium))
            .foregroundStyle(Tokens.Colors.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .background(Capsule().fill(Tokens.Colors.ink))
            .transition(.opacity)
            .accessibilityAddTraits(.isStaticText)
    }
}

extension View {
    /// Shows `text` as a toast at the bottom and clears it after a moment.
    func messageToast(_ text: Binding<String?>, bottom: CGFloat = 96) -> some View {
        overlay(alignment: .bottom) {
            if let line = text.wrappedValue {
                MessageToast(text: line)
                    .padding(.bottom, bottom)
                    .task(id: line) {
                        try? await Task.sleep(for: .seconds(2.5))
                        if text.wrappedValue == line { text.wrappedValue = nil }
                    }
            }
        }
        .animation(.snappy, value: text.wrappedValue)
    }
}
