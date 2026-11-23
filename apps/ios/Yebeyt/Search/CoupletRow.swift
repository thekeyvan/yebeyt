import SwiftUI

/// A couplet in a list (search, a mood): the two hemistichs, and «حافظ · غزل ۳ · بیت ۲» under them.
struct CoupletRow: View {
    @Environment(AppModel.self) private var app
    @Environment(Library.self) private var library
    let entry: CoupletEntry

    var body: some View {
        Button { app.openReader(ReaderRoute(path: entry.path, couplet: entry.index)) } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(TextNormalizer.plain(entry.couplet.m1)).font(.poem(16)).lineSpacing(0)
                if !entry.couplet.m2.isEmpty { Text(TextNormalizer.plain(entry.couplet.m2)).font(.poem(16)) }
                Text(ReaderText.caption(poet: library.poet(slug: entry.poet)?.name ?? "", title: entry.title, index: entry.index))
                    .font(.ui(11))
                    .foregroundStyle(Color(hex: 0x8A8698))
                    .padding(.top, 4)
            }
            .foregroundStyle(Tokens.Colors.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(EdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14))
            .listCard()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("couplet-\(entry.id)")
    }
}

/// «چیزی پیدا نشد»
struct NothingFound: View {
    var body: some View {
        Text("چیزی پیدا نشد")
            .font(.title(20))
            .foregroundStyle(Tokens.Colors.muted)
            .frame(maxWidth: .infinity)
            .padding(.top, 40)
            .accessibilityIdentifier("nothingFound")
    }
}
