import SwiftUI

/// The people search of «پیدا کردن دوست» in a mode for choosing someone, as a sheet: «پیام تازه» opens the chat with them,
/// the game lobby and the challenge card add them to the people to invite. `choose` returns the line to show when it
/// failed; nil closes the sheet.
struct PeoplePickSheet: View {
    @Environment(Session.self) private var session
    let title: String
    let choose: @MainActor (FoundPerson) async -> String?

    var body: some View {
        Inner(session: session, title: title, choose: choose)
    }

    private struct Inner: View {
        @Environment(\.dismiss) private var dismiss
        let title: String
        let choose: @MainActor (FoundPerson) async -> String?
        @State private var model: PeopleSearchModel
        @State private var text = ""
        @State private var toast: String?
        @FocusState private var focused: Bool

        init(session: Session, title: String, choose: @escaping @MainActor (FoundPerson) async -> String?) {
            _model = State(initialValue: PeopleSearchModel(session: session))
            self.title = title
            self.choose = choose
        }

        var body: some View {
            VStack(alignment: .leading, spacing: 14) {
                Text(title).font(.title(26)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader).padding(.top, 8)
                ScrollView {
                    PeopleSearchSection(model: model, text: $text, opens: false, toast: $toast, focus: $focused, pick: pick)
                        .padding(.bottom, 24)
                }
                .scrollIndicators(.hidden)
                .scrollDismissesKeyboard(.interactively)
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .dottedPaper()
            .toast($toast)
            .presentationDetents([.large])
            .task { focused = true }
        }

        private func pick(_ person: FoundPerson) {
            Task {
                if let line = await choose(person) { toast = line } else { dismiss() }
            }
        }
    }
}

/// «پیام تازه»: a tap opens the chat with the person.
struct NewChatSheet: View {
    @Environment(MessagesCenter.self) private var center

    var body: some View {
        PeoplePickSheet(title: "پیام تازه") { await center.openChat(username: $0.username) }
    }
}
