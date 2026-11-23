import SwiftUI

struct RootView: View {
    let model: AppModel

    var body: some View {
        ZStack(alignment: .bottom) {
            TabPage(tab: model.selectedTab)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    Color.clear.frame(height: TabBar.footprint)
                }
            TabBar(model: model)
        }
        // The bar sits 18pt above the screen edge, as on the board; the pages reserve its height.
        .ignoresSafeArea(.container, edges: .bottom)
    }
}
