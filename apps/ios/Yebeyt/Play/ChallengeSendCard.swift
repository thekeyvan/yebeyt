import SwiftUI

/// The card of ChallengeSend: «یکی رو به چالش بکش», the message that goes out as it will look, the ways to share the link and
/// «توی اپ: …» to send it to a friend in the app. The challenge is made on the server when the card first shows.
struct ChallengeSendCard: View {
    let offer: ChallengeOffer
    @Environment(Session.self) private var session
    @Environment(AccountModel.self) private var account
    @Environment(MessagesCenter.self) private var messages

    var body: some View {
        let name = session.user?.displayName ?? account.providerName ?? session.user?.username ?? ""
        Inner(offer: offer, session: session, name: name) { text, username in await messages.sendText(text, to: username) }
    }

    private struct Inner: View {
        @State private var sender: ChallengeSender
        @State private var friends: [PersonShort] = []
        @State private var picking = false
        @State private var toast: String?
        @Environment(Session.self) private var session
        @Environment(AvatarStore.self) private var avatar

        init(offer: ChallengeOffer, session: Session, name: String, sendText: @escaping @MainActor (String, String) async -> String?) {
            _sender = State(initialValue: ChallengeSender(offer: offer, session: session, name: name, sendText: sendText))
        }

        var body: some View {
            VStack(spacing: 14) {
                card
                friendsRow
            }
            .toast($toast)
            .sheet(isPresented: $picking) {
                PeoplePickSheet(title: "کی رو به چالش بکشی؟", invite: true) { person in
                    let line = await sender.send(to: person.username)
                    if line == nil { toast = PlayCopy.challengeSentTo(person.short.name) }
                    return line
                }
            }
            .task { await sender.create() }
            .task { await loadFriends() }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("challengeSend")
        }

        // MARK: The card

        private var card: some View {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("یکی رو به چالش بکش").font(.title(22)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                    Text("همین ۱۰ بیت رو بازی می‌کنه و نتیجه‌ها کنار هم میاد. اپ رو نداره؟ با همین لینک هم می‌تونه بازی کنه.")
                        .font(.ui(12.5)).foregroundStyle(Tokens.Colors.muted).lineSpacing(3)
                }
                preview
                if case .failed(let line) = sender.phase {
                    HStack {
                        Text(line).font(.ui(12)).foregroundStyle(Tokens.Colors.fire)
                        Spacer()
                        Button("دوباره") { Task { await sender.create() } }.font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                            .accessibilityIdentifier("challengeRetry")
                    }
                }
                ShareRow(
                    style: .labelled, prepare: { await shareable() },
                    story: { payload in ChallengeStoryCard.image(brag: sender.brag, couplet: sender.offer.first.m1, link: sender.linkText) },
                    copied: { toast = "کپی شد" }
                )
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 26).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 6, x: 0, y: 3))
        }

        /// A tap on a way to share waits for the challenge to be made.
        private func shareable() async -> SharePayload? {
            await sender.create()
            if sender.share == nil { toast = PlayCopy.challengePending }
            return sender.share
        }

        /// The message as the friend will get it: «چالش», who and how much, the first couplet, the link.
        private var preview: some View {
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    Face(parts: avatar.parts, size: 34, border: 2)
                    Text(sender.brag).font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.ink).lineSpacing(3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityIdentifier("challengeBrag")
                }
                Text("\(TextNormalizer.plain(sender.offer.first.m1))…")
                    .font(.poem(15)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center)
                HStack {
                    HStack(spacing: 6) {
                        HStack(spacing: 3) {
                            RoundedRectangle(cornerRadius: 3).fill(Tokens.Colors.lapis).frame(width: 9, height: 13).rotationEffect(.degrees(-8))
                            RoundedRectangle(cornerRadius: 3).fill(Tokens.Colors.fire).frame(width: 9, height: 13).rotationEffect(.degrees(6))
                        }
                        Text("یه بیت")
                    }
                    Spacer()
                    Text(sender.linkText).environment(\.layoutDirection, .leftToRight).accessibilityIdentifier("challengeLink")
                }
                .font(.ui(11)).foregroundStyle(Color(hex: 0x8A8698))
            }
            .padding(EdgeInsets(top: 14, leading: 14, bottom: 12, trailing: 14))
            .background(RoundedRectangle(cornerRadius: 18).fill(Tokens.Colors.boardPaper))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Color(hex: 0xE6E1D6), style: StrokeStyle(lineWidth: 2, dash: [5, 4])))
            .overlay(alignment: .topTrailing) {
                Text("چالش").font(.title(13)).foregroundStyle(Tokens.Colors.white).padding(.horizontal, 10).padding(.top, 2)
                    .sticker(fill: Tokens.Colors.magenta, radius: 999, border: 3, shadow: ShadowToken(y: 2, blur: 6, opacity: 0.2))
                    .tilted(-5)
                    .padding(.trailing, 14)
                    .offset(y: -14)
            }
        }

        // MARK: Friends in the app

        private var friendsRow: some View {
            HStack(spacing: 10) {
                Text("توی اپ:").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                HStack(spacing: -10) {
                    ForEach(friends.prefix(3), id: \.username) { FaceCircle(parts: $0.avatar, size: 36) }
                }
                Text(friends.prefix(3).map(\.name).joined(separator: "، ") + (friends.count > 3 ? "…" : ""))
                    .font(.ui(12)).foregroundStyle(Tokens.Colors.muted).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button { picking = true } label: {
                    Text("انتخاب").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("challengePick")
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 20).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.06), radius: 4, x: 0, y: 2))
        }

        private func loadFriends() async {
            guard let page = try? await session.authorized({ try await session.api.friends(cursor: nil, token: $0) }) else { return }
            friends = page.playable
        }
    }
}

/// The picture «استوری» shares for a challenge: the brag, the first couplet and the link.
struct ChallengeStoryCard: View {
    let brag: String
    let couplet: String
    let link: String

    var body: some View {
        VStack(spacing: 26) {
            Text("یه بیت").font(.title(54)).foregroundStyle(Tokens.Colors.lapis)
            VStack(spacing: 14) {
                Text(brag).font(.ui(20, weight: .bold)).multilineTextAlignment(.center).foregroundStyle(Tokens.Colors.ink)
                Text("\(TextNormalizer.plain(couplet))…").font(.poem(28)).multilineTextAlignment(.center).foregroundStyle(Tokens.Colors.muted)
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

    @MainActor
    static func image(brag: String, couplet: String, link: String) -> UIImage? {
        let renderer = ImageRenderer(content: ChallengeStoryCard(brag: brag, couplet: couplet, link: link))
        renderer.scale = 3
        return renderer.uiImage
    }
}
