import SwiftUI

/// Shown when the last sync before signing out did not go through: what is not on the account would be lost.
struct UnsyncedSignOutSheet: View {
    @Binding var isPresented: Bool
    /// «خروج»: signs out anyway.
    let signOut: () async -> Void
    @State private var busy = false

    var body: some View {
        VStack(spacing: 16) {
            Text("همه‌ی بیت‌هات هنوز به حسابت نرسیده. اگه الان خارج بشی، از این گوشی پاک می‌شن.")
                .font(.title(22)).lineSpacing(-2).multilineTextAlignment(.center).foregroundStyle(Tokens.Colors.ink)
                .accessibilityIdentifier("unsyncedTitle")
            HStack(spacing: 12) {
                Button { isPresented = false } label: {
                    Text("بمونم").frame(maxWidth: .infinity)
                }
                .buttonStyle(.sticker(.secondary))
                .accessibilityIdentifier("unsyncedStay")
                Button {
                    busy = true
                    Task {
                        await signOut()
                        busy = false
                        isPresented = false
                    }
                } label: {
                    Text("خروج").frame(maxWidth: .infinity)
                }
                .buttonStyle(DangerButtonStyle())
                .disabled(busy)
                .accessibilityIdentifier("unsyncedLeave")
            }
        }
        .padding(EdgeInsets(top: 28, leading: 22, bottom: 16, trailing: 22))
        .frame(maxWidth: .infinity)
        .fitsSheetHeight()
        .stickerSheet()
        .environment(\.layoutDirection, .rightToLeft)
    }
}
