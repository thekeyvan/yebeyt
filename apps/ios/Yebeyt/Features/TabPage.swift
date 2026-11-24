import SwiftUI

/// The page of the selected tab. Each tab has its own navigation stack; screens pushed on it keep the tab bar.
struct TabPage: View {
    @Bindable var model: AppModel
    /// The height the tab bar covers at the bottom; every screen on the stacks keeps its content clear of it.
    let reserve: CGFloat
    @Environment(\.layoutDirection) private var layoutDirection

    var body: some View {
        page
            .animation(Motion.bouncy, value: model.selectedTab)
    }

    /// The page slides in a little from the side of its tab, and the one that leaves fades out quickly.
    private func arrival(_ tab: Tab) -> (Motion.Variant) -> AnyTransition {
        { variant in
            let rightToLeft = layoutDirection == .rightToLeft
            var arrival = Motion.tabArrival(from: model.previousTab.index, to: tab.index, rightToLeft: rightToLeft, variant)
            if rightToLeft { arrival.dx = -arrival.dx }  // `.offset` mirrors x in right-to-left, `dx` is in screen directions
            return Motion.tab(arrival, variant)
        }
    }

    @ViewBuilder private var page: some View {
        switch model.selectedTab {
        case .home:
            NavigationStack(path: $model.homePath) {
                HomeView()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
            .motionTransition(arrival(.home))
        case .explore:
            NavigationStack(path: $model.explorePath) {
                ExploreView()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
            .motionTransition(arrival(.explore))
        case .games:
            NavigationStack(path: $model.gamesPath) {
                GamesView()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
            .motionTransition(arrival(.games))
        case .me:
            NavigationStack(path: $model.mePath) {
                ProfileScreen()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
            .motionTransition(arrival(.me))
        case .messages:
            NavigationStack(path: $model.messagesPath) {
                InboxScreen()
                    .swipeBack()
                    .clearOfTabBar(reserve)
                    .navigationDestination(for: Destination.self) { DestinationView(destination: $0).swipeBack().clearOfTabBar(reserve) }
            }
            .motionTransition(arrival(.messages))
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
