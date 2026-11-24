import SwiftUI

/// پیام‌ها: the chats, newest first, with a search over them. Board: `Inbox`.
struct InboxScreen: View {
    @Environment(MessagesCenter.self) private var center
    @Environment(AppModel.self) private var model
    @State private var composing = false

    var body: some View {
        @Bindable var inbox = center.inbox
        VStack(alignment: .leading, spacing: 16) {
            header
            SearchBox(text: $inbox.query, placeholder: "جستجو بین دوستات", style: .round)
                .accessibilityIdentifier("inboxSearch")
            if center.requests.incomingCount > 0 {
                RequestsRow(count: center.requests.incomingCount) { model.messagesPath.append(.friendRequests) }
            }
            content(inbox)
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $composing) { NewChatSheet() }
        .onAppear { inbox.isVisible = true }
        .onDisappear { inbox.isVisible = false }
        .task { await inbox.load() }
    }

    /// The title, «بازی با دوست» (the lobby) and «پیام تازه».
    private var header: some View {
        HStack(spacing: 12) {
            Text("پیام‌ها")
                .font(.title(30))
                .foregroundStyle(Tokens.Colors.ink)
                .accessibilityAddTraits(.isHeader)
                .padding(.top, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
            RoundButton(label: "بازی با دوست", action: { model.play(.lobby(LobbyStart())) }) {
                LineIcon(shape: GamesIcon(), size: 20, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.ink)
            }
            .accessibilityIdentifier("inboxGames")
            Button { composing = true } label: {
                LineIcon(shape: PencilIcon(), size: 20, lineWidth: 2.4, fill: nil)
                    .foregroundStyle(Tokens.Colors.white)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Tokens.Colors.lapis))
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .stickerShadow(ShadowToken(y: 2, blur: 16, opacity: 0.22))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("پیام تازه")
            .accessibilityIdentifier("inboxCompose")
        }
    }

    @ViewBuilder private func content(_ inbox: InboxModel) -> some View {
        switch inbox.phase {
        case .loading:
            Spacer()
        case .failed(let reason):
            failure(reason)
        case .loaded:
            if inbox.rows.isEmpty {
                note("هنوز گفتگویی نداری.")
            } else if inbox.visibleRows.isEmpty {
                note("کسی با این اسم پیدا نشد.")
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        let rows = inbox.visibleRows
                        ForEach(rows) { row in
                            InboxRow(row: row, last: row.id == rows.last?.id) { open(row) }
                                .onAppear { if row.id == rows.last?.id { Task { await inbox.loadMore() } } }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 4)
                    .background {
                        RoundedRectangle(cornerRadius: 24).fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 3, blur: 12, opacity: 0.08))
                    }
                    .padding(.bottom, 12)
                }
                .scrollIndicators(.hidden)
                .scrollClipDisabled()
            }
        }
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.ui(14)).foregroundStyle(Tokens.Colors.muted).padding(.horizontal, 4)
    }

    private func failure(_ reason: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            note(reason)
            Button("دوباره") { Task { await center.inbox.load() } }
                .font(.ui(14, weight: .bold))
                .foregroundStyle(Tokens.Colors.lapis)
                .padding(.horizontal, 4)
        }
    }

    private func open(_ row: ConversationItem) {
        _ = center.chat(for: center.inbox.conversation(row))
        model.messagesPath.append(.chat(row.id))
    }
}

private struct InboxRow: View {
    let row: ConversationItem
    let last: Bool
    let action: () -> Void

    var body: some View {
        let unread = row.unread > 0
        Button(action: action) {
            HStack(spacing: 12) {
                Face(parts: row.other.avatar, size: 52, border: 3, online: row.other.online == true)
                VStack(alignment: .leading, spacing: 0) {
                    Text(row.other.name)
                        .font(.ui(15, weight: unread ? .bold : .medium))
                        .foregroundStyle(Tokens.Colors.ink)
                    Text(InboxModel.preview(row.last))
                        .font(.ui(13, weight: unread ? .medium : .regular))
                        .foregroundStyle(unread ? Tokens.Colors.ink : Tokens.Colors.muted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: 6) {
                    Text(ChatTime.stamp(row.last.at, now: .now))
                        .font(.ui(12))
                        .foregroundStyle(Tokens.Colors.muted)
                    Circle()
                        .fill(unread ? Tokens.Colors.lapis : .clear)
                        .frame(width: 10, height: 10)
                }
            }
            .padding(.vertical, 10)
            .overlay(alignment: .bottom) {
                if !last { Tokens.Colors.chipBorder.frame(height: 1) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(row.other.name)، \(InboxModel.preview(row.last))")
        .accessibilityValue(unread ? "نخونده" : "")
        .accessibilityIdentifier("inboxRow-\(row.other.username)")
    }
}

/// «درخواست‌های دوستی» with how many wait, at the top of the inbox; it opens the requests.
private struct RequestsRow: View {
    let count: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                LineIcon(shape: SVGShape(d: "M4 19.5c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5M9.5 4.5a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8M19 7.5v5M16.5 10h5"), size: 22, lineWidth: 2.2, fill: nil)
                    .foregroundStyle(Tokens.Colors.ink)
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(Tokens.Colors.amber))
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.18))
                Text(FriendCopy.requestsTitle).font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(PersianDigits.string(count))
                    .font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                    .frame(minWidth: 26, minHeight: 26)
                    .padding(.horizontal, 4)
                    .background(Capsule().fill(Tokens.Colors.lapis))
                    .accessibilityIdentifier("requestsCount")
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background { RoundedRectangle(cornerRadius: 24).fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 3, blur: 12, opacity: 0.08)) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(FriendCopy.requestsTitle)، \(PersianDigits.string(count))")
        .accessibilityIdentifier("requestsRow")
    }
}
