import SwiftUI

/// The بازی tab (GamesE): the greeting for a signed-in person, the streak and points (the points open رده‌بندی),
/// today's puzzle with «۳ تا از دوستات حلش کردن», the مشاعره card for a signed-in person (the game waiting for their
/// answer, and «با یه دوست»), and the games with «+ بازی با دوست».
struct GamesView: View {
    @Environment(AppModel.self) private var app
    @Environment(GameDeck.self) private var deck
    @Environment(GameStats.self) private var stats
    @Environment(MyStats.self) private var myStats
    @Environment(FriendGames.self) private var friendGames
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
                if session.isSignedIn {
                    MoshCard(
                        urgent: friendGames.urgentMosh.flatMap { game in friendGames.me.map { MoshState(game: game, me: $0) } },
                        open: { app.play(.mosh($0)) }, withFriend: { app.play(.lobby(LobbyStart())) }
                    )
                    .padding(.top, 10)
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
            if session.isSignedIn { await friendGames.refreshMine() }
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
            HStack(spacing: 12) {
                Button { account.require(.games) { app.play(.lobby(LobbyStart())) } } label: {
                    Text("+ بازی با دوست").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().fill(Tokens.Colors.lapis).shadow(color: Tokens.Colors.lapis.opacity(0.25), radius: 4, x: 0, y: 2))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("newFriendGame")
                NavigationLink(value: Destination.gamesCatalog) {
                    Text("همه‌ی بازی‌ها").font(.ui(14, weight: .medium)).foregroundStyle(Tokens.Colors.lapis)
                }
                .accessibilityIdentifier("allGames")
            }
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
