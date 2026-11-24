import SwiftUI

/// Another person's page: Profile without the private parts. Face, name, @username, «<n> دوست», the league, then the
/// button of the friendship («درخواست دوستی», «درخواست فرستادی», «قبول» with «رد», or the chip «دوستین») and «پیام بده»,
/// and a ⋯ menu with «حذف از دوستا» (for a friend), «بلاک» and «گزارش».
struct PersonScreen: View {
    @Environment(Session.self) private var session
    @Environment(MessagesCenter.self) private var center
    let username: String

    var body: some View {
        PersonScreenBody(username: username, session: session, center: center)
    }
}

private struct PersonScreenBody: View {
    @Environment(AppModel.self) private var app
    @Environment(MessagesCenter.self) private var messages
    @Environment(\.dismiss) private var dismiss
    @Environment(BlockedPeople.self) private var blocked
    @State private var model: PersonModel
    @State private var confirmingBlock = false
    @State private var confirmingUnfriend = false
    @State private var pendingFriendAction: PendingFriendAction?
    @State private var reporting = false

    init(username: String, session: Session, center: MessagesCenter) {
        _model = State(initialValue: PersonModel(username: username, session: session, center: center))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                topBar
                switch model.phase {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                case .notFound:
                    Text("این آدم پیدا نشد").font(.title(20)).foregroundStyle(Tokens.Colors.muted)
                        .frame(maxWidth: .infinity).padding(.top, 40)
                        .accessibilityIdentifier("personNotFound")
                case .failed(let message):
                    Text(message).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).frame(maxWidth: .infinity).padding(.top, 40)
                case .loaded:
                    if let profile = model.profile { page(profile) }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .toast(Binding(get: { model.toast }, set: { model.toast = $0 }))
        .task { await model.load() }
        .onChange(of: messages.friendsRevision) { Task { await model.load() } }
        .sheet(isPresented: $confirmingBlock) {
            ConfirmSheet(
                title: "\(model.name) بلاک بشه؟", message: "دیگه نمی‌تونه بهت پیام بده یا درخواست دوستی بفرسته.", confirm: "بلاک کن",
                prefix: "block", isPresented: $confirmingBlock
            ) {
                if await model.block() {
                    blocked.add(model.username)
                    dismiss()
                }
            }
        }
        .sheet(isPresented: $confirmingUnfriend) {
            ConfirmSheet(
                title: FriendCopy.confirmUnfriend(name: model.name), message: nil, confirm: FriendCopy.confirmUnfriendButton,
                prefix: "unfriend", isPresented: $confirmingUnfriend
            ) { await model.perform(.unfriend) }
        }
        .askingBeforeFriendAction($pendingFriendAction) { await model.perform($0.action) }
        .sheet(isPresented: $reporting) {
            ReportSheet(name: model.name, isPresented: $reporting) { reason, note in await model.report(reason, note: note) }
        }
    }

    private var topBar: some View {
        HStack {
            BackButton()
            Spacer(minLength: 0)
            Menu {
                if model.friendship == .friends {
                    Button(FriendCopy.title(.unfriend)) { confirmingUnfriend = true }.accessibilityIdentifier("unfriendItem")
                }
                Button("بلاک") { confirmingBlock = true }.accessibilityIdentifier("blockItem")
                Button("گزارش") { reporting = true }.accessibilityIdentifier("reportItem")
            } label: {
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { _ in Circle().fill(Tokens.Colors.ink).frame(width: 4.5, height: 4.5) }
                }
                .frame(width: 44, height: 44)
                .background(Circle().fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.16), radius: 4, x: 0, y: 2))
            }
            .accessibilityLabel("بیشتر")
            .accessibilityIdentifier("personMenu")
        }
    }

    private func page(_ profile: PublicProfile) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 16) {
                AvatarView(parts: profile.avatar ?? .standard)
                    .padding(4)
                    .background(Circle().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 4, blur: 14, opacity: 0.18)))
                    .frame(width: 104, height: 104)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile.short.name).font(.title(28)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                        .accessibilityIdentifier("personName")
                    HStack(spacing: 4) {
                        Text("@\(profile.username)").environment(\.layoutDirection, .leftToRight)
                        Text("·")
                        Text("\(PersianDigits.string(profile.friendsCount)) دوست").accessibilityIdentifier("personFriends")
                    }
                    .font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
                    if let league = profile.league {
                        Text(LeaderboardLayout.leagueName(tier: league.tier))
                            .font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                            .padding(.horizontal, 10).padding(.vertical, 3)
                            .background(Capsule().fill(Tokens.Colors.white))
                            .padding(.top, 2)
                            .accessibilityIdentifier("personLeague")
                    }
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 10) {
                if profile.friendship == .friends {
                    Text(FriendCopy.friends).font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.muted)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Capsule().fill(Tokens.Colors.trackLight))
                        .accessibilityIdentifier("personFriendChip")
                }
                ForEach(profile.friendship.buttons, id: \.self) { action in
                    Button {
                        if action.asksFirst { pendingFriendAction = PendingFriendAction(action: action, username: model.username) } else { Task { await model.perform(action) } }
                    } label: { Text(FriendCopy.title(action)).frame(maxWidth: .infinity) }
                        .buttonStyle(.sticker(action.isMain ? .primary : .secondary))
                        .disabled(model.isBusy)
                        .accessibilityIdentifier("person-\(action)")
                }
                if model.canMessage {
                    Button { Task { model.toast = await messages.openChat(username: model.username) } } label: { Text("پیام بده").frame(maxWidth: .infinity) }
                        .buttonStyle(.sticker(.secondary))
                        .accessibilityIdentifier("personMessage")
                }
            }
        }
    }
}

/// «گزارش»: a reason, an optional note, and send.
struct ReportSheet: View {
    let name: String
    @Binding var isPresented: Bool
    /// Returns whether the report went through (the sheet closes then).
    let send: (PersonModel.Reason, String) async -> Bool
    @State private var reason = PersonModel.Reason.spam
    @State private var note = ""
    @State private var busy = false

    var body: some View {
        VStack(spacing: 14) {
            Text("گزارش \(name)").font(.title(24)).foregroundStyle(Tokens.Colors.ink)
            HStack(spacing: 8) {
                ForEach(PersonModel.Reason.allCases, id: \.self) { item in
                    let on = item == reason
                    Button { reason = item } label: {
                        Text(item.title).font(.ui(13, weight: on ? .bold : .medium))
                            .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Capsule().fill(on ? Tokens.Colors.lapis : Tokens.Colors.paper))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                    .accessibilityIdentifier("reason-\(item)")
                }
            }
            TextField("", text: $note, prompt: Text("اگه خواستی بیشتر بگو (اختیاری)").foregroundStyle(Color(hex: 0x8A8698)), axis: .vertical)
                .font(.ui(14)).lineLimit(1...3)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.paper))
                .accessibilityIdentifier("reportNote")
            Button {
                busy = true
                Task {
                    if await send(reason, note) { isPresented = false }
                    busy = false
                }
            } label: { Text("بفرست").frame(maxWidth: .infinity) }
                .buttonStyle(.sticker(.primary))
                .disabled(busy)
                .accessibilityIdentifier("reportSend")
        }
        .padding(EdgeInsets(top: 28, leading: 22, bottom: 16, trailing: 22))
        .presentationDetents([.height(340)])
        .presentationBackground(Tokens.Colors.white)
        .presentationCornerRadius(30)
        .presentationDragIndicator(.visible)
        .environment(\.layoutDirection, .rightToLeft)
    }
}
