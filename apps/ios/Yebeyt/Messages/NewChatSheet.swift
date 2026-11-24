import SwiftUI

/// «پیام تازه»: the people search of «پیدا کردن دوست» in a mode for choosing someone; a tap opens the chat with them.
struct NewChatSheet: View {
    @Environment(Session.self) private var session

    var body: some View {
        Inner(session: session)
    }

    private struct Inner: View {
        @Environment(\.dismiss) private var dismiss
        @Environment(MessagesCenter.self) private var center
        @State private var model: PeopleSearchModel
        @State private var text = ""
        @State private var toast: String?
        @FocusState private var focused: Bool

        init(session: Session) {
            _model = State(initialValue: PeopleSearchModel(session: session))
        }

        var body: some View {
            VStack(alignment: .leading, spacing: 14) {
                Text("پیام تازه").font(.title(26)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader).padding(.top, 8)
                ScrollView {
                    PeopleSearchSection(model: model, text: $text, opens: false, toast: $toast, focus: $focused, pick: choose)
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

        private func choose(_ person: FoundPerson) {
            Task {
                if let line = await center.openChat(username: person.username) {
                    toast = line
                } else {
                    dismiss()
                }
            }
        }
    }
}
