import SwiftUI

/// «درخواست‌های دوستی»: the requests I got, each with «قبول» and «رد», and under them «فرستادی»: the ones I sent, each
/// with «لغو». Accepting moves the person to my friends; rejecting just removes the row (they are not told).
struct RequestsScreen: View {
    @Environment(MessagesCenter.self) private var center
    @State private var toast: String?
    @State private var pending: PendingFriendAction?

    var body: some View {
        let requests = center.requests
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: FriendCopy.requestsTitle)
                content(requests)
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .toast($toast)
        .askingBeforeFriendAction($pending) { toast = await center.requests.perform($0.action, on: $0.username) }
        .onAppear { requests.isVisible = true }
        .onDisappear { requests.isVisible = false }
        .task { await requests.load() }
    }

    /// «قبول» goes at once; «رد» and «لغو» ask first.
    private func ask(_ action: FriendAction, _ username: String, _ requests: FriendRequestsModel) {
        if action.asksFirst { pending = PendingFriendAction(action: action, username: username) } else { Task { toast = await requests.perform(action, on: username) } }
    }

    @ViewBuilder private func content(_ requests: FriendRequestsModel) -> some View {
        switch requests.phase {
        case .loading:
            ProgressView().frame(maxWidth: .infinity).padding(.top, 24)
        case .failed(let message):
            Text(message).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).frame(maxWidth: .infinity).padding(.top, 24)
        case .loaded:
            if requests.incoming.isEmpty, requests.outgoing.isEmpty {
                Text(FriendCopy.noRequests).font(.ui(14)).foregroundStyle(Tokens.Colors.muted)
                    .frame(maxWidth: .infinity).padding(.top, 32)
                    .accessibilityIdentifier("noRequests")
            }
            if !requests.incoming.isEmpty {
                PeopleCard {
                    ForEach(requests.incoming) { request in
                        RequestRow(request: request) {
                            HStack(spacing: 8) {
                                ForEach(Friendship.incoming.buttons, id: \.self) { action in
                                    FriendButton(title: FriendCopy.title(action), quiet: action == .reject, busy: requests.pending.contains(request.username)) {
                                        ask(action, request.username, requests)
                                    }
                                    .accessibilityIdentifier("\(action == .accept ? "accept" : "reject")-\(request.username)")
                                }
                            }
                        }
                    }
                }
            }
            if !requests.outgoing.isEmpty {
                Text(FriendCopy.sentSection).font(.title(22)).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityAddTraits(.isHeader).padding(.top, 8)
                PeopleCard {
                    ForEach(requests.outgoing) { request in
                        RequestRow(request: request) {
                            FriendButton(title: FriendCopy.cancelSent, quiet: true, busy: requests.pending.contains(request.username)) {
                                ask(.cancel, request.username, requests)
                            }
                            .accessibilityIdentifier("cancel-\(request.username)")
                        }
                    }
                }
            }
        }
    }
}

/// A request: the person (opens their page) and the buttons at the end.
private struct RequestRow<Buttons: View>: View {
    let request: FriendRequest
    @ViewBuilder let buttons: Buttons

    var body: some View {
        HStack(spacing: 12) {
            NavigationLink(value: Destination.person(request.username)) { PersonIdentity(person: request.short) }
                .buttonStyle(.plain)
                .accessibilityIdentifier("request-\(request.username)")
            buttons
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}
