import SwiftUI

/// «پیدا کردن دوست»: a field for a username and the people found, each with the button of its friendship.
struct PeopleScreen: View {
    @Environment(Session.self) private var session

    var body: some View {
        PeopleScreenBody(session: session)
    }
}

private struct PeopleScreenBody: View {
    @Environment(AppModel.self) private var app
    @State private var model: PeopleSearchModel
    @State private var text = ""
    @State private var toast: String?
    @FocusState private var focused: Bool

    init(session: Session) {
        _model = State(initialValue: PeopleSearchModel(session: session))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: "پیدا کردن دوست")
                PeopleSearchSection(model: model, text: $text, opens: true, toast: $toast, focus: $focused)
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .toast($toast)
        .task {
            focused = true
            text = app.peopleStart
            app.peopleStart = ""  // only the first opening starts with text
        }
    }
}

/// The search field and its results, on «پیدا کردن دوست» and under the invite card of OnbFriends.
struct PeopleSearchSection: View {
    let model: PeopleSearchModel
    @Binding var text: String
    let opens: Bool
    @Binding var toast: String?
    var focus: FocusState<Bool>.Binding?
    /// Set to choose someone instead of asking them (the sheet of a new chat).
    var pick: ((FoundPerson) -> Void)?
    @Environment(BlockedPeople.self) private var blocked

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SearchBox(text: $text, placeholder: "نام کاربری…", style: .round, focus: focus)
                .environment(\.layoutDirection, .rightToLeft)
                .accessibilityIdentifier("peopleSearch")
                .onChange(of: text) { _, new in model.queryChanged(new) }
            results
        }
    }

    @ViewBuilder private var results: some View {
        switch model.phase {
        case .idle:
            EmptyView()
        case .loading where blocked.visible(model.people).isEmpty:
            ProgressView().frame(maxWidth: .infinity).padding(.top, 24)
        case .failed(let message):
            Text(message).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).frame(maxWidth: .infinity).padding(.top, 24)
        case .loaded where blocked.visible(model.people).isEmpty:
            NothingFound()
        default:
            PeopleCard {
                ForEach(blocked.visible(model.people), id: \.username) { person in
                    PersonRow(person: person, busy: model.pending.contains(person.username), opens: opens, pick: pick) { action in
                        Task { toast = await model.perform(action, on: person.username) }
                    }
                }
            }
        }
    }
}

/// The same search under the invite card of OnbFriends: the rows ask but don't open a page, as onboarding has no stack.
struct OnboardingPeopleSearch: View {
    @Environment(Session.self) private var session

    var body: some View {
        Inner(session: session)
    }

    private struct Inner: View {
        @State private var model: PeopleSearchModel
        @State private var text = ""
        @State private var toast: String?

        init(session: Session) {
            _model = State(initialValue: PeopleSearchModel(session: session))
        }

        var body: some View {
            PeopleSearchSection(model: model, text: $text, opens: false, toast: $toast)
                .toast($toast)
        }
    }
}
