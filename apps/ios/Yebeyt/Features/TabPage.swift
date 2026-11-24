import SwiftUI

/// The page of the selected tab. Each tab has its own navigation stack; screens pushed on it keep the tab bar.
struct TabPage: View {
    @Bindable var model: AppModel

    var body: some View {
        switch model.selectedTab {
        case .home:
            NavigationStack(path: $model.homePath) {
                HomeView()
                    .swipeBack()
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack() }
            }
        case .explore:
            NavigationStack(path: $model.explorePath) {
                ExploreView()
                    .swipeBack()
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack() }
            }
        case .games:
            NavigationStack(path: $model.gamesPath) {
                GamesView()
                    .swipeBack()
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack() }
            }
        case .me:
            NavigationStack(path: $model.mePath) {
                ProfileScreen()
                    .swipeBack()
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack() }
            }
        case .messages:
            NavigationStack { PlaceholderPage(tab: model.selectedTab).swipeBack() }
        }
    }
}

/// An empty tab page: only its name as a title, at the top, start-aligned.
/// Every tab sits on dotted paper.
struct PlaceholderPage: View {
    let tab: Tab

    var body: some View {
        Text(tab.title)
            .font(.title(titleSize))
            .foregroundStyle(Tokens.Colors.ink)
            .accessibilityAddTraits(.isHeader)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .dottedPaper()
            .toolbar(.hidden, for: .navigationBar)
    }

    /// The title sizes of the boards: Calm 32, Explore 40, GamesE 40, Inbox 30, Profile 34.
    private var titleSize: CGFloat {
        switch tab {
        case .home: 32
        case .explore, .games: 40
        case .messages: 30
        case .me: 34
        }
    }
}
