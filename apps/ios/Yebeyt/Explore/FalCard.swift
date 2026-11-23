import SwiftUI

/// «فال حافظ»: «باز کن» opens a random Hafez ghazal in the whole-poem view (the fal has no flow of its own yet).
struct FalCard: View {
    @Environment(AppModel.self) private var app
    @Environment(Library.self) private var library

    var body: some View {
        Button { Task { await open() } } label: {
            HStack(spacing: 14) {
                LineIcon(shape: BookIcon(), size: 26, lineWidth: 2, fill: nil)
                    .foregroundStyle(Tokens.Colors.ink)
                    .frame(width: 54, height: 54)
                    .sticker(fill: Tokens.Colors.amber, radius: 999, border: 4, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.25))
                    .frame(width: 54, height: 54)
                    .tilted(-8)
                VStack(alignment: .leading, spacing: 2) {
                    Text("فال حافظ").font(.title(24)).lineLimit(1)
                    Text("یه نیت کن، دیوان رو باز کن").font(.ui(13)).foregroundStyle(Color(hex: 0xD6D8FF))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text("باز کن")
                    .font(.title(17))
                    .foregroundStyle(Tokens.Colors.lapis)
                    .padding(EdgeInsets(top: 8, leading: 14, bottom: 4, trailing: 14))
                    .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.white))
            }
            .foregroundStyle(Tokens.Colors.white)
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
            .sticker(fill: Tokens.Colors.lapis, radius: 26, border: 5, shadow: ShadowToken(y: 4, blur: 14, opacity: 0.2))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("فال حافظ، باز کن")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("fal")
    }

    private func open() async {
        guard let hafez = library.book(path: "/hafez"), let index = try? await library.index(of: hafez),
              let ghazal = index.poems(in: hafez.mainSection.id).randomElement() else { return }
        app.openReader(ReaderRoute(path: ghazal.path, mode: .scroll))
    }
}
