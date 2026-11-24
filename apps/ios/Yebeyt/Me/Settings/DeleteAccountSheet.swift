import SwiftUI

/// «حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟» with «پاک کن» and «نه».
struct DeleteAccountSheet: View {
    @Environment(Session.self) private var session
    @Environment(ReaderMarks.self) private var marks
    @Environment(PrivacyStore.self) private var privacy
    @Environment(AvatarStore.self) private var avatar
    @Environment(DivanSync.self) private var divanSync
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
            let deletion = AccountDeletion(session: session, data: LocalAccountData(marks: marks, privacy: privacy, avatar: avatar), divanSync: divanSync)
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
