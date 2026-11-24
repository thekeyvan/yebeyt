import SwiftUI

/// Someone's face in a list: a circle with a white border and a soft shadow. A person who hasn't chosen one has the
/// board's face; a hidden stranger (`plain`) is a bare circle.
struct FaceCircle: View {
    var parts: AvatarParts?
    var size: CGFloat = 40
    var plain = false

    var body: some View {
        Group {
            if plain {
                Tokens.Colors.ring
            } else {
                AvatarView(parts: parts ?? .standard)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
        .shadow(color: Tokens.Colors.ink.opacity(0.22), radius: 2.5, x: 0, y: 1)
        .accessibilityHidden(true)
    }
}

/// A small capsule button of a row: lapis for the main action, grey for the quiet one.
struct FriendButton: View {
    let title: String
    var quiet = false
    var busy = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.ui(13, weight: .bold))
                .foregroundStyle(quiet ? Tokens.Colors.muted : Tokens.Colors.white)
                .padding(.horizontal, 14)
                .frame(height: 38)
                .background(Capsule().fill(quiet ? Tokens.Colors.trackLight : Tokens.Colors.lapis))
                .opacity(busy ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }
}

/// What a row shows at its end for the friendship: «درخواست دوستی», «درخواست فرستادی» (tap to cancel), «قبول» with
/// «رد», or the chip «دوستین» for a friend.
struct FriendControl: View {
    let username: String
    let friendship: Friendship
    var busy = false
    let act: (FriendAction) -> Void

    var body: some View {
        if friendship.buttons.isEmpty {
            Text(FriendCopy.friends)
                .font(.ui(13, weight: .bold))
                .foregroundStyle(Tokens.Colors.muted)
                .padding(.horizontal, 14)
                .frame(height: 38)
                .background(Capsule().fill(Tokens.Colors.trackLight))
                .accessibilityIdentifier("friends-\(username)")
        } else {
            HStack(spacing: 8) {
                ForEach(friendship.buttons, id: \.self) { action in
                    FriendButton(title: FriendCopy.title(action), quiet: action != friendship.buttons.first, busy: busy) { act(action) }
                        .accessibilityIdentifier("\(Self.identifier(action))-\(username)")
                }
            }
        }
    }

    private static func identifier(_ action: FriendAction) -> String {
        switch action {
        case .send, .cancel: "friend"
        case .accept: "accept"
        case .reject: "reject"
        case .unfriend: "unfriend"
        }
    }
}

/// A person's face, name and @username.
struct PersonIdentity: View {
    let person: PersonShort

    var body: some View {
        HStack(spacing: 12) {
            FaceCircle(parts: person.avatar, size: 48)
            VStack(alignment: .leading, spacing: 0) {
                Text(person.name).font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                Text("@\(person.username)").font(.ui(12)).foregroundStyle(Tokens.Colors.muted).lineLimit(1)
                    .environment(\.layoutDirection, .leftToRight)
            }
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// A person in a list (search, friends): face, name, @username and what the friendship offers. In a stack, the row
/// opens the person's page; in onboarding (`opens: false`) it doesn't.
struct PersonRow: View {
    let person: FoundPerson
    var busy = false
    var opens = true
    /// Set when the list is for choosing someone (a new chat): a tap picks, and there are no buttons.
    var pick: ((FoundPerson) -> Void)?
    let act: (FriendAction) -> Void

    var body: some View {
        HStack(spacing: 12) {
            if let pick {
                Button { pick(person) } label: { PersonIdentity(person: person.short) }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("newChat-\(person.username)")
            } else if opens {
                NavigationLink(value: Destination.person(person.username)) { PersonIdentity(person: person.short) }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("person-\(person.username)")
            } else {
                PersonIdentity(person: person.short)
            }
            if pick == nil {
                FriendControl(username: person.username, friendship: person.friendship, busy: busy, act: act)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

/// The white card the rows of people sit in (lazy, so a long list loads its next page only when the end comes into view).
struct PeopleCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        LazyVStack(spacing: 0) { content }
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background { RoundedRectangle(cornerRadius: 24).fill(Tokens.Colors.white).shadow(color: Tokens.Colors.ink.opacity(0.08), radius: 11, x: 0, y: 6) }
    }
}

extension View {
    /// A short black pill at the bottom for a message («گزارشت رسید»); it goes by itself.
    func toast(_ message: Binding<String?>) -> some View {
        overlay(alignment: .bottom) {
            if let text = message.wrappedValue {
                Text(text)
                    .font(.ui(13, weight: .medium))
                    .foregroundStyle(Tokens.Colors.white)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(Capsule().fill(Tokens.Colors.ink))
                    .padding(.bottom, 96)
                    .transition(.opacity)
                    .accessibilityIdentifier("toast")
            }
        }
        .animation(.snappy, value: message.wrappedValue)
        .task(id: message.wrappedValue) {
            guard message.wrappedValue != nil else { return }
            try? await Task.sleep(for: .seconds(2.5))
            if !Task.isCancelled { message.wrappedValue = nil }
        }
    }
}
