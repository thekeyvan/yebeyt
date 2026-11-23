import SwiftUI

struct RootView: View {
    @Bindable var model: AppModel

    var body: some View {
        ZStack(alignment: .bottom) {
            TabPage(model: model)
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    Color.clear.frame(height: TabBar.footprint)
                }
            TabBar(model: model)
                .ignoresSafeArea(.keyboard)  // the keyboard covers the bar instead of pushing it up
        }
        // The bar sits 18pt above the screen edge, as on the board; the pages reserve its height.
        .ignoresSafeArea(.container, edges: .bottom)
        .fullScreenCover(item: $model.reader) { route in
            ReaderView(
                route: route, close: { model.closeReader() }, playWithCouplet: { model.playWithCouplet() },
                openPoet: { model.openPoet(slug: $0) }
            )
        }
    }
}
