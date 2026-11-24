import SwiftUI

/// پیام‌ها: the chats, newest first, with a search over them. Board: `Inbox`.
struct InboxScreen: View {
    @Environment(MessagesCenter.self) private var center
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var inbox = center.inbox
        VStack(alignment: .leading, spacing: 16) {
            Text("پیام‌ها")
                .font(.title(30))
                .foregroundStyle(Tokens.Colors.ink)
                .accessibilityAddTraits(.isHeader)
                .padding(.top, 4)
            SearchBox(text: $inbox.query, placeholder: "جستجو بین دوستات", style: .round)
                .accessibilityIdentifier("inboxSearch")
            content(inbox)
        }
        .padding(.horizontal, 18)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task { await inbox.load() }
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
