import SwiftUI

/// The page of the selected tab. Each tab has its own navigation stack; screens pushed on it keep the tab bar.
struct TabPage: View {
    @Bindable var model: AppModel

    var body: some View {
        switch model.selectedTab {
        case .home:
            NavigationStack { HomeView().swipeBack() }
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
            NavigationStack(path: $model.messagesPath) {
                InboxScreen()
                    .swipeBack()
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack() }
            }
        }
    }
}
