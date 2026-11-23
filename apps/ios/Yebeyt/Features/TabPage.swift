import SwiftUI

/// An empty tab page: only its name as a title, at the top, start-aligned.
/// The home tab has plain paper, the others dotted paper.
struct TabPage: View {
    let tab: Tab

    var body: some View {
        Text(tab.title)
            .font(.title(titleSize))
            .foregroundStyle(Tokens.Colors.ink)
            .frame(height: titleSize * 1.05)
            .accessibilityAddTraits(.isHeader)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .background { paper }
    }

    @ViewBuilder private var paper: some View {
        if tab == .home {
            Tokens.Colors.paper.ignoresSafeArea()
        } else {
            DottedPaper().ignoresSafeArea()
        }
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
