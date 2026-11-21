import SwiftUI

/// A deck for one mood, or ten random couplets ("بیت‌گردی").
struct MoodDeckView: View {
    let key: String
    @Environment(Library.self) private var library
    @State private var items: [CoupletRef] = []
    @State private var index = 0

    private var mood: Mood? { Content.moods.first { $0.key == key } }

    var body: some View {
        VStack(spacing: 0) {
            ScreenBar(title: mood?.title ?? "بیت‌گردی")
            ScrollView {
                VStack(spacing: 16) {
                    Text(mood?.detail ?? "ده بیت از هر جای شعر فارسی").font(.ui(14)).foregroundStyle(Palette.muted)
                    if !items.isEmpty {
                        DeckView(items: $items, index: $index, kind: key)
                    }
                }
                .pagePadding()
                .padding(.top, 4).padding(.bottom, 28)
            }
            .scrollIndicators(.hidden)
        }
        .background(Palette.bg)
        .onAppear {
            guard items.isEmpty else { return }
            items = mood?.items ?? library.randomCouplets(10)
        }
    }
}
