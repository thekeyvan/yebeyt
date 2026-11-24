import Observation
import SwiftUI

/// A small people search for a new chat: by username or name, and a tap opens the chat. The friends slice has its
/// own people screen; the two are unified when they meet.
@MainActor @Observable
final class NewChatModel {
    var query = ""
    private(set) var results: [ChatPerson] = []
    private(set) var failure: String?

    @ObservationIgnored private let session: Session
    @ObservationIgnored private let openChat: @MainActor (String) async -> String?

    /// `openChat` is `MessagesCenter.openChat(username:)`: nil when it opened, else the line to show.
    init(session: Session, openChat: @escaping @MainActor (String) async -> String?) {
        self.session = session
        self.openChat = openChat
    }

    func search() async {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            results = []
            failure = nil
            return
        }
        do {
            let found = try await session.authorized { try await self.session.api.searchChatPeople(query: text, token: $0) }
            guard text == query.trimmingCharacters(in: .whitespacesAndNewlines) else { return }  // typing went on
            results = found
            failure = nil
        } catch let error as APIError {
            results = []
            failure = error.persianMessage
        } catch {}
    }

    /// True when the chat opened (the sheet closes); false leaves `failure` to show.
    func open(_ person: ChatPerson) async -> Bool {
        if let line = await openChat(person.username) {
            failure = line
            return false
        }
        return true
    }
}

struct NewChatSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model: NewChatModel

    init(session: Session, center: MessagesCenter) {
        _model = State(initialValue: NewChatModel(session: session) { await center.openChat(username: $0) })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("پیام تازه").font(.title(26)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader).padding(.top, 8)
            SearchBox(text: $model.query, placeholder: "اسم یا نام کاربری", style: .round)
                .accessibilityIdentifier("newChatSearch")
            if let failure = model.failure {
                Text(failure).font(.ui(14)).foregroundStyle(Tokens.Colors.muted)
            }
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(model.results, id: \.username) { person in
                        Button {
                            Task { if await model.open(person) { dismiss() } }
                        } label: {
                            HStack(spacing: 12) {
                                Face(parts: person.avatar, size: 44, border: 3)
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(person.name).font(.ui(15, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                                    Text(person.username).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .meCard(radius: 20, shadow: 0.06)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("newChat-\(person.username)")
                    }
                }
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
        }
        .padding(.horizontal, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .dottedPaper()
        .presentationDetents([.large])
        .task(id: model.query) {
            try? await Task.sleep(for: .milliseconds(300))  // typing goes on: a new query cancels this one
            if !Task.isCancelled { await model.search() }
        }
    }
}
