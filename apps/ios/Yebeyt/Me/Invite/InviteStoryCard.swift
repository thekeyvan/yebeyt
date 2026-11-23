import SwiftUI

/// The picture «استوری» shares: the opener couplet on a sticker card, with the personal link.
struct InviteStoryCard: View {
    let link: String

    var body: some View {
        VStack(spacing: 26) {
            Text("یه بیت").font(.title(54)).foregroundStyle(Tokens.Colors.lapis)
            VStack(spacing: 14) {
                Text(InviteTone.short.body).font(.ui(18, weight: .medium)).foregroundStyle(Tokens.Colors.muted)
                Text("«\(InviteMessage.opener)»").font(.poem(30)).lineSpacing(10).multilineTextAlignment(.center).foregroundStyle(Tokens.Colors.ink)
            }
            .padding(28)
            .frame(maxWidth: .infinity)
            .stickerCard()
            Text(link).font(.ui(18, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                .environment(\.layoutDirection, .leftToRight)
                .padding(.horizontal, 24).padding(.vertical, 10)
                .background(Capsule().fill(Tokens.Colors.lapis))
        }
        .padding(28)
        .frame(width: 360, height: 640)
        .background { DottedPaper() }
        .environment(\.layoutDirection, .rightToLeft)
    }

    /// The card as an image (1080×1920).
    @MainActor
    static func image(link: String) -> UIImage? {
        let renderer = ImageRenderer(content: InviteStoryCard(link: link))
        renderer.scale = 3
        return renderer.uiImage
    }
}
