import SwiftUI

/// The home tab: the date, «بیتِ امروز» and its card. The friends' section stays hidden until friends exist.
struct HomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(PoetryStore.self) private var poetry
    @Environment(Library.self) private var library
    @Environment(\.scenePhase) private var scenePhase
    @State private var home = HomeModel()
    @State private var share: ReaderModel.Share?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(PersianDate.line(for: .now)).font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
                    Text("بیتِ امروز").font(.title(32)).foregroundStyle(Tokens.Colors.ink)
                        .accessibilityAddTraits(.isHeader)
                }
                if let pick = home.pick {
                    DailyCard(
                        pick: pick,
                        open: { app.openReader(ReaderRoute(path: pick.path, couplet: pick.index)) },
                        send: {
                            share = ReaderModel.Share(text: ReaderText.shareText(pick.couplet, poet: pick.poet, title: pick.title))
                        },
                        reject: { Task { await home.reject(poetry: poetry, library: library) } }
                    )
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task { await home.load(poetry: poetry, library: library) }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await home.refresh(today: DailyPick.dayNumber(for: .now), poetry: poetry, library: library) } }
        }
        .sheet(item: $share) { ShareSheet(text: $0.text).presentationDetents([.medium, .large]) }
    }
}
