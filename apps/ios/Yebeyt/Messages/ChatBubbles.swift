import SwiftUI

/// The words under a bubble: «۹:۴۰» for the other person's, «تو · ۹:۴۲ · دیده شد» for mine.
private struct MessageMeta: View {
    let time: String
    let mine: Bool
    var seen = false

    var body: some View {
        Text(mine ? "تو · \(time)\(seen ? " · \(MessageCopy.seen)" : "")" : time)
            .font(.ui(11))
            .foregroundStyle(Tokens.Colors.muted)
    }
}

/// One text bubble: white and straight corner at the top for the other person, lapis for me.
struct TextBubble: View {
    let text: String
    let mine: Bool
    var muted = false

    var body: some View {
        let corners = RectangleCornerRadii(
            topLeading: mine ? 20 : 6, bottomLeading: 20, bottomTrailing: 20, topTrailing: mine ? 6 : 20
        )
        let ink = mine ? Tokens.Colors.white : muted ? Tokens.Colors.muted : Tokens.Colors.ink
        Text(ChallengeLink.linked(text, color: ink))
            .font(.ui(15))
            .lineSpacing(3)
            .tint(ink)
            .foregroundStyle(ink)
            .multilineTextAlignment(.leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background {
                UnevenRoundedRectangle(cornerRadii: corners)
                    .fill(mine ? Tokens.Colors.lapis : Tokens.Colors.white.opacity(muted ? 0.6 : 1))
                    .shadow(color: Tokens.Colors.ink.opacity(mine ? 0 : 0.10), radius: 4, x: 0, y: 2)
            }
            // The widest a bubble gets; the background above hugs the text.
            .frame(maxWidth: 250, alignment: mine ? .trailing : .leading)
            .feedbackPrivate()
    }
}

/// «امروز»: the label between days.
struct DayLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.ui(12))
            .foregroundStyle(Tokens.Colors.muted)
            .padding(.horizontal, 12)
            .padding(.vertical, 3)
            .background(Capsule().fill(Tokens.Colors.white.opacity(0.8)))
            .frame(maxWidth: .infinity)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A couplet sent in the chat: the sender line, the card (the poem is read by its key), the note under it.
struct CoupletMessageView: View {
    let message: ChatMessage
    let seen: Bool
    let other: ChatPerson
    let hold: (ResolvedCouplet) -> Void
    let open: (ResolvedCouplet) -> Void
    let delete: () -> Void
    let report: () -> Void

    var body: some View {
        let mine = message.fromMe
        let time = ChatTime.clock(message.createdAt)
        VStack(alignment: mine ? .trailing : .leading, spacing: 6) {
            senderLine(mine: mine, time: time)
            CoupletCardView(key: message.key ?? "", id: message.id, mine: mine, hold: hold, open: open)
            if let note = message.note, !note.isEmpty {
                TextBubble(text: note, mine: mine)
                    .contextMenu { actions(mine: mine) } preview: { TextBubble(text: note, mine: mine) }
                MessageMeta(time: time, mine: mine, seen: seen)
            } else if mine {
                MessageMeta(time: time, mine: true, seen: seen)
            }
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }

    /// «سارا یه بیت برات فرستاد · ۹:۴۰». Long-pressing it reports (or deletes) the message, as the card's own long press
    /// is the couplet menu.
    private func senderLine(mine: Bool, time: String) -> some View {
        Group {
            if mine {
                Text("تو یه بیت فرستادی · \(time)")
            } else {
                Text("\(Text(other.name).font(.ui(12, weight: .bold)).foregroundColor(Tokens.Colors.ink)) یه بیت برات فرستاد · \(time)")
            }
        }
        .font(.ui(12))
        .foregroundStyle(Tokens.Colors.muted)
        .contextMenu { actions(mine: mine) }
    }

    @ViewBuilder private func actions(mine: Bool) -> some View {
        if mine {
            Button("پاک کن", role: .destructive, action: delete)
        } else {
            Button("گزارش", action: report)
        }
    }
}

/// The white card of a couplet: its two hemistichs, the poet's chip and «کل شعر». The other person's has the amber
/// «برای تو» sticker. Tap opens the poem; long press lifts the couplet.
struct CoupletCardView: View {
    @Environment(CoupletResolver.self) private var resolver
    let key: String
    let id: String
    let mine: Bool
    let hold: (ResolvedCouplet) -> Void
    let open: (ResolvedCouplet) -> Void
    @State private var resolved: ResolvedCouplet?

    var body: some View {
        let corners = RectangleCornerRadii(topLeading: mine ? 22 : 6, bottomLeading: 22, bottomTrailing: 22, topTrailing: mine ? 6 : 22)
        VStack(spacing: 4) {
            if let resolved {
                CoupletText(couplet: resolved.couplet, settings: Self.settings, size: 18, factor: 1.7, color: Tokens.Colors.ink)
                HStack {
                    Text(resolved.poetName)
                        .font(.ui(12, weight: .bold))
                        .foregroundStyle(Tokens.Colors.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Tokens.Colors.magenta))
                    Spacer(minLength: 0)
                    Text("کل شعر").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
                .padding(.top, 4)
            } else {
                Text("…").font(.ui(18)).foregroundStyle(Tokens.Colors.muted).padding(.vertical, 20)
            }
        }
        .padding(EdgeInsets(top: 18, leading: 16, bottom: 12, trailing: 16))
        .frame(width: 262)
        .background {
            UnevenRoundedRectangle(cornerRadii: corners).fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 3, blur: 24, opacity: 0.14))
        }
        .overlay(alignment: .topTrailing) {
            if !mine {
                Text("برای تو")
                    .font(.title(14))
                    .padding(.horizontal, 10)
                    .padding(.top, 4)
                    .padding(.bottom, 2)
                    .foregroundStyle(Tokens.Colors.ink)
                    .sticker(fill: Tokens.Colors.amber, radius: 999, border: 3, shadow: Tokens.Sticker.Shadow.badge)
                    .tilted(-9)
                    .padding(.trailing, 14)
                    .offset(y: -12)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if let resolved { open(resolved) } }
        .onLongPressGesture(minimumDuration: 0.45) { if let resolved { hold(resolved) } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(resolved.map { "\($0.couplet.m1)، \($0.couplet.m2)، \($0.source)" } ?? "بیت")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: "کارهای این بیت") { if let resolved { hold(resolved) } }
        .accessibilityIdentifier("coupletCard-\(id)")
        .task(id: key) { resolved = await resolver.resolve(key) }
    }

    /// The chat's cards are always the board's: Parastoo Bold, centred.
    private static let settings: TextSettings = {
        var settings = TextSettings()
        settings.layout = .centered
        return settings
    }()
}

/// «سارا یه بیت به دیوان مشترک اضافه کرد»: tapping it opens the shared divan.
struct DivanLineView: View {
    let message: ChatMessage
    let other: ChatPerson
    let open: () -> Void

    var body: some View {
        let text = message.fromMe ? MessageCopy.divanAddedByMe : MessageCopy.divanAdded(by: other.name)
        Button(action: open) {
            HStack(spacing: 6) {
                LineIcon(shape: SharedDivanIcon(), size: 16, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.lapis)
                Text(text).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Capsule().fill(Tokens.Colors.white.opacity(0.8)))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityLabel(text)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("divanLine-\(message.id)")
    }
}

/// A text of either person: the bubble and its time; long-press reports it (theirs) or takes it back (mine).
struct TextMessageView: View {
    let message: ChatMessage
    /// Who wrote it, for VoiceOver (the bubble itself carries no name).
    let senderName: String
    let seen: Bool
    let delete: () -> Void
    let report: () -> Void

    var body: some View {
        let mine = message.fromMe
        VStack(alignment: mine ? .trailing : .leading, spacing: 3) {
            TextBubble(text: message.deleted ? MessageCopy.deletedMessage : message.text ?? "", mine: mine, muted: message.deleted)
                .contextMenu {
                    if !message.deleted {
                        if mine {
                            Button("پاک کن", role: .destructive, action: delete)
                        } else {
                            Button("گزارش", action: report)
                        }
                    }
                } preview: {
                    // The long-press preview is a copy of the bubble: covered while recording, like the bubble.
                    TextBubble(text: message.deleted ? MessageCopy.deletedMessage : message.text ?? "", mine: mine, muted: message.deleted)
                }
            MessageMeta(time: ChatTime.clock(message.createdAt), mine: mine, seen: seen)
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(FeedbackPrivacy.shared.covering ? "پنهان" : spoken)
        .accessibilityIdentifier("bubble-\(message.id)")
    }
}

extension TextMessageView {
    /// «سارا: سلام، ۹:۴۰» · «تو: سلام، ۹:۴۲، دیده شد»
    var spoken: String {
        let body = message.deleted ? MessageCopy.deletedMessage : message.text ?? ""
        let who = message.fromMe ? "تو" : senderName
        return "\(who): \(body)، \(ChatTime.clock(message.createdAt))\(seen ? "، \(MessageCopy.seen)" : "")"
    }
}

/// A send on its way: «در حال فرستادن», or «نرسید · دوباره» to tap when it failed.
struct PendingMessageView: View {
    let pending: ChatModel.Pending
    let retry: () -> Void
    let discard: () -> Void

    private static func text(of pending: ChatModel.Pending) -> String {
        switch pending.content {
        case .text(let text): text
        case .couplet(_, let note): note ?? MessageCopy.couplet
        }
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 3) {
            switch pending.content {
            case .text(let text):
                TextBubble(text: text, mine: true).opacity(pending.failed ? 0.7 : 0.85)
            case .couplet(let key, let note):
                CoupletCardView(key: key, id: pending.clientId, mine: true, hold: { _ in }, open: { _ in }).opacity(pending.failed ? 0.7 : 0.85)
                if let note { TextBubble(text: note, mine: true).opacity(pending.failed ? 0.7 : 0.85) }
            }
            if pending.refused {
                Text(MessageCopy.refused).font(.ui(11, weight: .bold)).foregroundStyle(Tokens.Colors.fire)
            } else if pending.failed {
                Button(action: retry) {
                    Text(MessageCopy.notSent).font(.ui(11, weight: .bold)).foregroundStyle(Tokens.Colors.fire)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("retry-\(pending.clientId)")
            } else {
                Text(MessageCopy.sending).font(.ui(11)).foregroundStyle(Tokens.Colors.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .contextMenu {
            if pending.failed { Button("پاک کن", role: .destructive, action: discard) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("تو: \(FeedbackPrivacy.shared.covering ? "پنهان" : Self.text(of: pending))، \(pending.refused ? MessageCopy.refused : pending.failed ? MessageCopy.notSent : MessageCopy.sending)")
        .accessibilityAddTraits(pending.failed && !pending.refused ? .isButton : [])
        .accessibilityAction { if pending.failed && !pending.refused { retry() } }
        .accessibilityIdentifier("pending-\(pending.clientId)")
    }
}
