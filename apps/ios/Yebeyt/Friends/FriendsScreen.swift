import SwiftUI

/// «<n> دوست»: the people who follow me back, with the same rows as the search.
struct FriendsScreen: View {
    @Environment(Session.self) private var session

    var body: some View {
        FriendsScreenBody(session: session)
    }
}

private struct FriendsScreenBody: View {
    @State private var model: FriendsListModel
    @State private var toast: String?
    @Environment(BlockedPeople.self) private var blocked

    init(session: Session) {
        _model = State(initialValue: FriendsListModel(session: session))
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: "دوستا")
                content
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .toast($toast)
        .task { await model.load() }
    }

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().frame(maxWidth: .infinity).padding(.top, 24)
        case .failed(let message):
            Text(message).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).frame(maxWidth: .infinity).padding(.top, 24)
        case .loaded where blocked.visible(model.people).isEmpty:
            Text("هنوز دوستی نداری. از «پیدا کردن دوست» شروع کن.")
                .font(.ui(14)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity).padding(.top, 32)
                .accessibilityIdentifier("noFriends")
        case .loaded:
            PeopleCard {
                let visible = blocked.visible(model.people)
                ForEach(visible, id: \.username) { person in
                    PersonRow(person: person, busy: model.pending.contains(person.username)) {
                        Task { toast = await model.toggleFollow(person.username) }
                    }
                    .onAppear { if person.username == visible.last?.username { Task { await model.loadMore(hiding: blocked) } } }
                }
            }
        }
    }
}
