import SwiftUI
import UIKit

/// The chat with one person. Board: `Direct`. It is found by the conversation id, which the inbox (or
/// `MessagesCenter.openChat`) has made known.
struct ChatScreen: View {
    @Environment(MessagesCenter.self) private var center
    let id: String

    var body: some View {
        if let chat = center.chat(id: id) {
            ChatContent(chat: chat)
        } else {
            Color.clear.dottedPaper().toolbar(.hidden, for: .navigationBar)
        }
    }
}

private struct ChatContent: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @Bindable var chat: ChatModel
    @State private var draft = ""
    @State private var picking = false
    @State private var deleting: ChatMessage?
    @State private var reporting: ChatMessage?
    @State private var keyboardUp = false
    /// The bottom of the list is on screen: new messages scroll into view; otherwise a pill says there is one.
    @State private var atBottom = true
    @State private var newBelow = false

    /// The chat is looked at: on screen, the app in front, and no poem opened over it.
    private var isLooked: Bool { scenePhase == .active && model.reader == nil }

    var body: some View {
        VStack(spacing: 10) {
            header.padding(.horizontal, 18)
            list
        }
        .padding(.top, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .dottedPaper()
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .toolbar(.hidden, for: .navigationBar)
        .messageToast($chat.toast, serial: chat.toastSerial, bottom: 150)
        .sheet(isPresented: $picking) {
            CoupletPickerSheet(title: "بیت بفرست", action: "بفرست") { key, note in chat.sendCouplet(key: key, note: note) }
        }
        .sheet(isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })) {
            ConfirmSheet(
                title: "این پیام پاک بشه؟", message: nil, confirm: "پاک کن", prefix: "deleteMessage",
                isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })
            ) {
                if let message = deleting { await chat.delete(message) }
            }
        }
        .confirmationDialog("چرا گزارشش می‌کنی؟", isPresented: Binding(get: { reporting != nil }, set: { if !$0 { reporting = nil } }), titleVisibility: .visible) {
            ForEach(ReportReason.allCases, id: \.self) { reason in
                Button(reason.title) {
                    if let message = reporting { Task { await chat.report(message, reason: reason) } }
                }
            }
            Button("بیخیال", role: .cancel) {}
        }
        // A challenge link in a message opens the challenge in the app.
        .environment(\.openURL, OpenURLAction { url in
            guard let code = ChallengeLink.code(of: url) else { return .systemAction }
            model.play(.challenge(code))
            return .handled
        })
        .onAppear { chat.isVisible = isLooked }
        .onDisappear { chat.isVisible = false }
        .onChange(of: isLooked) { _, looked in chat.isVisible = looked }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardUp = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardUp = false }
        .task {
            await chat.load()
            await chat.loadLeague()
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 10) {
            BackButton()
            Face(parts: chat.other.avatar, size: 46, border: 4, online: chat.other.online == true)
            VStack(alignment: .leading, spacing: 0) {
                Text(chat.other.name).font(.ui(17, weight: .bold)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                if let line = chat.statusLine {
                    Text(line).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            Button { model.messagesPath.append(.sharedDivan(chat.other.username)) } label: {
                HStack(spacing: 6) {
                    LineIcon(shape: SharedDivanIcon(), size: 18, lineWidth: 2.2, fill: nil)
                    Text("دیوان مشترک").font(.ui(12, weight: .bold))
                }
                .foregroundStyle(Tokens.Colors.lapis)
                .padding(.horizontal, 12)
                .frame(height: 40)
                .background(Capsule().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 2, blur: 16, opacity: 0.10)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("دیوان مشترک با \(chat.other.name)")
            .accessibilityIdentifier("sharedDivanButton")
        }
        .padding(.bottom, 4)
    }

    // MARK: Messages

    private var list: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    let entries = chat.entries()
                    if chat.hasOlder {
                        Color.clear.frame(height: 1).onAppear { loadOlder(entries.first?.id, proxy) }
                    }
                    if case .failed(let reason) = chat.phase {
                        failure(reason)
                    }
                    ForEach(entries) { entry in
                        row(entry).id(entry.id)
                    }
                    Color.clear.frame(height: 1).id(Self.bottomID)
                        .onAppear {
                            atBottom = true
                            newBelow = false
                        }
                        .onDisappear { atBottom = false }
                }
                .padding(.horizontal, 18)
                .padding(.top, 6)
                .padding(.bottom, 8)
            }
            .defaultScrollAnchor(.bottom)
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: chat.entries().last?.id) { _, _ in
                guard let last = chat.entries().last else { return }
                // What I send scrolls into view; what comes while I am reading higher up only shows the pill.
                if atBottom || isMine(last) {
                    withAnimation(.snappy) { proxy.scrollTo(Self.bottomID, anchor: .bottom) }
                } else {
                    newBelow = true
                }
            }
            .overlay(alignment: .bottom) {
                if newBelow {
                    Button {
                        withAnimation(.snappy) { proxy.scrollTo(Self.bottomID, anchor: .bottom) }
                    } label: {
                        Text(MessageCopy.newMessage)
                            .font(.ui(13, weight: .bold))
                            .foregroundStyle(Tokens.Colors.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(Tokens.Colors.lapis))
                            .overlay(Capsule().strokeBorder(Tokens.Colors.white, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                    .padding(.bottom, 8)
                    .accessibilityIdentifier("newMessagePill")
                }
            }
        }
    }

    private static let bottomID = "bottom"

    private func isMine(_ entry: ChatModel.Entry) -> Bool {
        switch entry.content {
        case .pending: true
        case .message(let message): message.fromMe
        case .day: false
        }
    }

    private func loadOlder(_ anchor: String?, _ proxy: ScrollViewProxy) {
        guard !chat.isLoadingOlder else { return }
        Task {
            await chat.loadOlder()
            if let anchor { proxy.scrollTo(anchor, anchor: .top) }
        }
    }

    private func failure(_ reason: String) -> some View {
        VStack(spacing: 8) {
            Text(reason).font(.ui(14)).foregroundStyle(Tokens.Colors.muted)
            Button("دوباره") { Task { await chat.load() } }.font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
        }
        .padding(.top, 40)
    }

    @ViewBuilder private func row(_ entry: ChatModel.Entry) -> some View {
        switch entry.content {
        case .day(let label):
            DayLabel(text: label)
        case .pending(let pending):
            PendingMessageView(pending: pending, retry: { chat.retry(pending.clientId) }, discard: { chat.discard(pending.clientId) })
        case .message(let message):
            switch message.kind {
            case .text:
                TextMessageView(message: message, senderName: chat.other.name, seen: entry.seen, delete: { deleting = message }, report: { reporting = message })
            case .couplet where message.deleted:
                TextMessageView(message: message, senderName: chat.other.name, seen: entry.seen, delete: {}, report: {})
            case .couplet:
                CoupletMessageView(
                    message: message, seen: entry.seen, other: chat.other, hold: hold, open: open,
                    delete: { deleting = message }, report: { reporting = message }
                )
            case .game:
                GameCardView(message: message, other: chat.other)
            case .system where message.payload?.event == "game_ended":
                GameCardView(message: message, other: chat.other)
            case .system:
                DivanLineView(message: message, other: chat.other) { model.messagesPath.append(.sharedDivan(chat.other.username)) }
            }
        }
    }

    private func open(_ couplet: ResolvedCouplet) {
        model.openReader(ReaderRoute(path: couplet.path, couplet: couplet.index))
    }

    /// A long press on a card: the same menu as everywhere, with «به دیوان مشترک» for this person.
    private func hold(_ couplet: ResolvedCouplet) {
        var held = couplet.held
        held.sharedWith = chat.other
        withAnimation(.snappy) { model.hold = held }
    }

    // MARK: Composer

    @ViewBuilder private var composer: some View {
        VStack(spacing: 10) {
            if chat.isClosed {
                Text(MessageCopy.closed)
                    .font(.ui(13, weight: .medium))
                    .foregroundStyle(Tokens.Colors.muted)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity)
                    .background(Capsule().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.1)))
                    .accessibilityIdentifier("closedLine")
            } else {
                quickActions
                inputRow
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, keyboardUp ? 10 : 26)
    }

    /// «بیت بفرست», the two games with this friend (the lobby opens with them chosen) and today's puzzle.
    private var quickActions: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                chip("بیت بفرست", enabled: true, id: "quickCouplet", action: { picking = true }) {
                    HStack(spacing: 2) {
                        RoundedRectangle(cornerRadius: 3).fill(Tokens.Colors.lapis).frame(width: 8, height: 12)
                        RoundedRectangle(cornerRadius: 3).fill(Tokens.Colors.fire).frame(width: 8, height: 12)
                    }
                }
                chip("مشاعره", enabled: true, id: "quickMosh", action: { model.play(.lobby(LobbyStart(game: .mosh, friend: person))) }) {
                    SVGShape(d: "M4 7h11l-3-3M20 17H9l3 3").stroke(Tokens.Colors.amber, style: StrokeStyle(lineWidth: 2.6 * 16 / 24, lineCap: .round, lineJoin: .round)).frame(width: 16, height: 16)
                }
                chip("بازی رودررو", enabled: true, id: "quickDuel", action: { model.play(.lobby(LobbyStart(game: .duel, friend: person))) }) {
                    LineIcon(shape: GamesIcon(), size: 16, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.lapis)
                }
                chip("معمای امروز", enabled: true, id: "quickDaily", action: { model.play(.daily) }) {
                    HStack(spacing: 2) {
                        RoundedRectangle(cornerRadius: 2).fill(Tokens.Colors.green).frame(width: 7, height: 9)
                        RoundedRectangle(cornerRadius: 2).fill(Tokens.Colors.amber).frame(width: 7, height: 9)
                        RoundedRectangle(cornerRadius: 2).fill(Tokens.Colors.trackLight).frame(width: 7, height: 9)
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
    }

    /// This chat's person, for the lobby.
    private var person: PersonShort { PersonShort(username: chat.other.username, displayName: chat.other.displayName, avatar: chat.other.avatar) }

    private func chip(_ title: String, enabled: Bool, id: String, action: @escaping () -> Void, @ViewBuilder icon: () -> some View) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                icon()
                Text(title).font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.14)))
            .fixedSize()
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityIdentifier(id)
    }

    private var inputRow: some View {
        HStack(spacing: 8) {
            TextField("", text: $draft, prompt: Text("پیام بنویس…").foregroundStyle(Color(hex: 0x8A8698)))
                .font(.ui(15))
                .foregroundStyle(Tokens.Colors.ink)
                .submitLabel(.send)
                .onSubmit(send)
                .padding(.horizontal, 16)
                .frame(height: 48)
                .background(Capsule().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 2, blur: 10, opacity: 0.16)))
                .accessibilityIdentifier("composer")
            Button(action: send) {
                LineIcon(shape: MessagesIcon(), size: 20, lineWidth: 2.4, fill: nil)
                    .foregroundStyle(Tokens.Colors.white)
                    .scaleEffect(x: -1, y: 1)
                    .frame(width: 48, height: 48)
                    .background(Circle().fill(Tokens.Colors.lapis))
                    .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                    .stickerShadow(ShadowToken(y: 2, blur: 10, opacity: 0.22))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("فرستادن")
            .accessibilityIdentifier("sendMessage")
        }
    }

    private func send() {
        if chat.send(text: draft) { draft = "" }
    }
}
