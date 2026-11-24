import SwiftUI

/// The بازی tab (GamesE): the greeting for a signed-in person, the streak and points (the points open رده‌بندی),
/// today's puzzle with «۳ تا از دوستات حلش کردن», and the games. The مشاعره card and «+ بازی با دوست» stay hidden
/// until games with friends exist.
struct GamesView: View {
    @Environment(AppModel.self) private var app
    @Environment(GameDeck.self) private var deck
    @Environment(GameStats.self) private var stats
    @Environment(MyStats.self) private var myStats
    @Environment(Session.self) private var session
    @Environment(AccountModel.self) private var account

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header
                if let puzzle = DailyPuzzle.pick(day: stats.today, from: deck) {
                    DailyPuzzleCard(
                        puzzle: puzzle, day: stats.today, finished: (stats.daily(on: stats.today)?.outcome ?? .playing) != .playing,
                        friendsLine: myStats.friendsLine, open: { app.play(.daily) }
                    )
                }
                gamesHeading
                grid
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task(id: "\(session.isSignedIn)|\(stats.today.number)") {
            await myStats.refresh()
            await myStats.refreshFriends(on: stats.today)
        }
    }

    /// «سلام نیلوفر!» for a signed-in person, as the provider or the person named themselves.
    private var greeting: String? {
        guard session.isSignedIn, let name = session.user?.displayName ?? account.providerName ?? session.user?.username else { return nil }
        return "سلام \(name)!"
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                if let greeting {
                    Text(greeting).font(.ui(14)).foregroundStyle(Tokens.Colors.muted).accessibilityIdentifier("greeting")
                }
                Text("بازی").font(.title(40)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
            }
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                StickerBadge(kind: .streak(myStats.streak)).accessibilityLabel("رشته‌ی \(PersianDigits.string(myStats.streak)) روزه")
                Button { account.require(.leaderboard) { app.gamesPath.append(.leaderboard) } } label: {
                    StickerBadge(kind: .points(myStats.points))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("امتیاز \(PersianDigits.grouped(myStats.points)) و رده‌بندی")
                .accessibilityIdentifier("leaderboardLink")
            }
            .padding(.bottom, 6)
        }
    }

    private var gamesHeading: some View {
        HStack {
            Text("بازی‌ها").font(.title(24)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
            Spacer()
            NavigationLink(value: Destination.gamesCatalog) {
                Text("همه‌ی بازی‌ها").font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.lapis)
            }
            .accessibilityIdentifier("allGames")
        }
    }

    private var grid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 24) {
            ForEach(GameKind.tabCards, id: \.self) { kind in
                GameCard(kind: kind) { start(kind) }
            }
        }
        .padding(.top, 8)
    }

    private func start(_ kind: GameKind) {
        if let route = kind.route { app.play(route) }
    }
}

/// A game on the tab: its colour, name and a few words, with its sticker at the corner. The games with friends are
/// dimmed and open nothing.
struct GameCard: View {
    let kind: GameKind
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 0)
                Text(kind.name).font(.title(22)).lineLimit(1).minimumScaleFactor(0.8)
                if let tagline = kind.tagline { Text(tagline).font(.ui(12, weight: .medium)) }
            }
            .foregroundStyle(Tokens.Colors.ink)
            .padding(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
            .frame(maxWidth: .infinity, minHeight: 102, maxHeight: 102, alignment: .leading)
            .sticker(fill: kind.background.0, radius: 24, border: 5, shadow: Tokens.Sticker.Shadow.card)
            .overlay(alignment: .topTrailing) { GameIcon(kind: kind).padding(.trailing, 8).offset(y: -14) }
            .opacity(kind.isBuilt ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!kind.isBuilt)
        .accessibilityLabel(kind.name)
        .accessibilityIdentifier("game-\(kind.rawValue)")
    }
}
