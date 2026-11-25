import SwiftUI

/// «به دیوان مشترک»: the sheet the long-press menu opens. In a chat the person is known, so only the note is
/// asked; elsewhere the friends with a shared divan are listed, and «با یه دوست دیگه» lists the other friends.
struct SharedDivanSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var adder: SharedDivanAdder
    /// Told the line to show once the sheet has closed: «به دیوان من و سارا اضافه شد».
    let done: (String) -> Void

    init(target: SharedDivanTarget, session: Session, done: @escaping (String) -> Void) {
        _adder = State(initialValue: SharedDivanAdder(target: target, session: session))
        self.done = done
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("به دیوان مشترک").font(.title(26)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader).padding(.top, 8)
            if let chosen = adder.chosen {
                note(for: chosen)
            } else {
                people
            }
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dottedPaper()
        .dismissesKeyboardOnTap()
        .overlay(alignment: .bottom) {
            if let failure = adder.failure { MessageToast(text: failure).padding(.bottom, 24).accessibilityIdentifier("sheetFailure") }
        }
        .presentationDetents([.medium, .large])
        .stickerSheet(white: false)
        .task {
            await adder.load()
            if adder.person == nil, adder.divans.isEmpty { await adder.showFriends() }
        }
        .onChange(of: adder.phase) { _, phase in
            if case .done(let line) = phase {
                dismiss()
                done(line)
            }
        }
    }

    // MARK: Who

    private var people: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                ForEach(adder.divans) { divan in
                    personRow(divan.other, detail: "\(PersianDigits.string(divan.counts.total)) بیت")
                }
                if adder.showsFriends {
                    if !adder.divans.isEmpty, !adder.friends.isEmpty {
                        Text("دوستای دیگه").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.muted).padding(.top, 6)
                    }
                    ForEach(adder.friends, id: \.username) { personRow($0, detail: nil) }
                    if adder.divans.isEmpty, adder.friends.isEmpty, !adder.isLoading {
                        Text("هنوز دوستی نداری که دیوان مشترک داشته باشی.").font(.ui(14)).foregroundStyle(Tokens.Colors.muted)
                    }
                } else {
                    Button { Task { await adder.showFriends() } } label: {
                        Text("با یه دوست دیگه").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).padding(.vertical, 10)
                    }
                    .accessibilityIdentifier("otherFriend")
                }
            }
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
    }

    private func personRow(_ person: ChatPerson, detail: String?) -> some View {
        Button { adder.chosen = person } label: {
            HStack(spacing: 12) {
                Face(parts: person.avatar, size: 44, border: 3)
                Text(person.name).font(.ui(15, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                Spacer(minLength: 0)
                if let detail { Text(detail).font(.ui(12)).foregroundStyle(Tokens.Colors.muted) }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .meCard(radius: 20, shadow: 0.06)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("divanWith-\(person.username)")
    }

    // MARK: The note

    private func note(for person: ChatPerson) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Face(parts: person.avatar, size: 44, border: 3)
                Text("دیوان من و \(person.name)").font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                Spacer(minLength: 0)
                if adder.person == nil {
                    Button("تغییر") { adder.chosen = nil }.font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
            }
            TextField("", text: $adder.note, prompt: Text("یه یادداشت (اختیاری)").foregroundStyle(Color(hex: 0x8A8698)))
                .font(.ui(15))
                .foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 16)
                .frame(height: 48)
                .background(Capsule().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.12)))
                .onChange(of: adder.note) { _, new in
                    if new.utf16.count > SharedDivanAdder.maxNoteLength { adder.note = new.limited(toUTF16: SharedDivanAdder.maxNoteLength) }
                }
                .feedbackPrivate()
                .accessibilityIdentifier("divanNote")
            Button("اضافه کن") { Task { await adder.add() } }
                .buttonStyle(.sticker(.primary))
                .disabled(adder.phase == .adding)
                .accessibilityIdentifier("divanAdd")
            Spacer(minLength: 0)
        }
    }
}

extension View {
    /// The sheet of «به دیوان مشترک» for the couplet in `target`; `done` gets the line to show after it closes.
    func sharedDivanSheet(item target: Binding<SharedDivanTarget?>, done: @escaping (String) -> Void) -> some View {
        modifier(SharedDivanSheetHost(target: target, done: done))
    }
}

private struct SharedDivanSheetHost: ViewModifier {
    @Environment(Session.self) private var session
    @Binding var target: SharedDivanTarget?
    let done: (String) -> Void

    func body(content: Content) -> some View {
        content.sheet(item: $target) { SharedDivanSheet(target: $0, session: session, done: done) }
    }
}
