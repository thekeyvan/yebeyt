import SwiftUI

/// The page of the selected tab. Each tab has its own navigation stack; screens pushed on it keep the tab bar.
struct TabPage: View {
    @Bindable var model: AppModel
    /// The height the tab bar covers at the bottom; every screen on the stacks keeps its content clear of it.
    let reserve: CGFloat

    var body: some View {
        switch model.selectedTab {
        case .home:
            NavigationStack(path: $model.homePath) {
                HomeView()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
        case .explore:
            NavigationStack(path: $model.explorePath) {
                ExploreView()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
        case .games:
            NavigationStack(path: $model.gamesPath) {
                GamesView()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
        case .me:
            NavigationStack(path: $model.mePath) {
                ProfileScreen()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
        case .messages:
            NavigationStack(path: $model.messagesPath) {
                InboxScreen()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
        }
    }
}

private extension View {
    /// The bar covers the home-indicator area itself (it sits 18pt above the screen edge), so with the bar the
    /// screen ignores that area and reserves exactly the bar's footprint; without it the screen is left as it is.
    func clearOfTabBar(_ height: CGFloat) -> some View {
        safeAreaInset(edge: .bottom, spacing: 0) { Color.clear.frame(height: height) }
            .ignoresSafeArea(.container, edges: height > 0 ? .bottom : [])
    }
}
