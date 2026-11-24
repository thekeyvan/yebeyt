import SwiftUI
import UIKit

/// What a share row sends: the text with the link in it (for the messengers and «بیشتر») and the link alone (for «کپی لینک»).
struct SharePayload: Equatable {
    var text: String
    var url: String
}

/// The row of ways to send a link: پیامک, تلگرام, واتس‌اپ, استوری, کپی لینک, بیشتر. The messengers open their compose
/// screen with the text; when one isn't installed the iOS share sheet opens instead. `prepare` makes the payload when
/// a button is tapped (a game or a challenge is made on the server first), and returns nil when it can't be made.
struct ShareRow: View {
    enum Style {
        /// 50pt circles with a name under each (InviteFriends, ChallengeSend).
        case labelled
        /// 40pt circles without names, the copy button first (GameLobby).
        case compact
    }

    let style: Style
    let prepare: @MainActor () async -> SharePayload?
    /// The picture «استوری» shares; nil leaves the button out.
    var story: (@MainActor (SharePayload) -> UIImage?)?
    let copied: @MainActor () -> Void
    @State private var sharing: Sharing?

    private struct Sharing: Identifiable {
        let id = UUID()
        let items: [Any]
    }

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            switch style {
            case .labelled:
                channel(.sms) { LineIcon(shape: SMSIcon(), size: 22, lineWidth: 2.2, fill: nil) }
                channel(.telegram) { LineIcon(shape: MessagesIcon(), size: 22, lineWidth: 2.2, fill: nil) }
                channel(.whatsApp) { LineIcon(shape: WhatsAppIcon(), size: 22, lineWidth: 2.2, fill: nil) }
                if let story {
                    action("استوری", id: "story", fill: Tokens.Colors.white, ink: Tokens.Colors.ink, perform: { payload in
                        if let image = story(payload) { sharing = Sharing(items: [image]) }
                    }) { StoryIcon() }
                }
                copy(fill: Tokens.Colors.lapis, ink: Tokens.Colors.white)
                more()
            case .compact:
                copy(fill: Tokens.Colors.lapis, ink: Tokens.Colors.white)
                Spacer(minLength: 0)
                channel(.sms) { LineIcon(shape: SMSIcon(), size: 18, lineWidth: 2.2, fill: nil) }
                Spacer(minLength: 0)
                channel(.telegram) { LineIcon(shape: MessagesIcon(), size: 18, lineWidth: 2.2, fill: nil) }
                Spacer(minLength: 0)
                channel(.whatsApp) { LineIcon(shape: WhatsAppIcon(), size: 18, lineWidth: 2.2, fill: nil) }
                Spacer(minLength: 0)
                more()
            }
        }
        .frame(maxWidth: .infinity)
        .sheet(item: $sharing) { ShareSheet(items: $0.items).presentationDetents([.medium, .large]) }
    }

    private var labelled: Bool { style == .labelled }

    private func channel(_ channel: InviteChannel, @ViewBuilder icon: () -> some View) -> some View {
        action(channel.title, id: "channel-\(channel.scheme)", fill: Tokens.Colors.white, ink: Tokens.Colors.ink, perform: { open(channel, $0) }, icon: icon)
    }

    private func copy(fill: Color, ink: Color) -> some View {
        action("کپی لینک", id: "copyLink", fill: fill, ink: ink, perform: { payload in
            UIPasteboard.general.string = payload.url
            copied()
        }) { LineIcon(shape: LinkIcon(), size: labelled ? 22 : 18, lineWidth: 2.2, fill: nil) }
    }

    private func more() -> some View {
        action("بیشتر", id: "more", fill: Tokens.Colors.white, ink: Tokens.Colors.ink, perform: { sharing = Sharing(items: [$0.text]) }) {
            LineIcon(shape: MoreIcon(), size: labelled ? 22 : 18, lineWidth: 2.2, fill: nil)
        }
    }

    private func action(
        _ title: String, id: String, fill: Color, ink: Color, perform: @escaping @MainActor (SharePayload) -> Void, @ViewBuilder icon: () -> some View
    ) -> some View {
        let size: CGFloat = labelled ? 50 : 40
        return Button {
            Task { if let payload = await prepare() { perform(payload) } }
        } label: {
            VStack(spacing: 5) {
                icon().foregroundStyle(ink)
                    .frame(width: size, height: size)
                    .background(Circle().fill(fill).stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.1)))
                if labelled { Text(title).font(.ui(11, weight: .medium)).foregroundStyle(Tokens.Colors.ink) }
            }
            .frame(maxWidth: labelled ? .infinity : nil)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityIdentifier(id)
    }

    /// The messenger's compose screen with the text; when it isn't installed, the share sheet.
    private func open(_ channel: InviteChannel, _ payload: SharePayload) {
        guard let url = channel.url(for: payload.text) else { sharing = Sharing(items: [payload.text]); return }
        if channel == .sms {
            UIApplication.shared.open(url) { opened in if !opened { Task { @MainActor in sharing = Sharing(items: [payload.text]) } } }
        } else if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        } else {
            sharing = Sharing(items: [payload.text])
        }
    }
}
