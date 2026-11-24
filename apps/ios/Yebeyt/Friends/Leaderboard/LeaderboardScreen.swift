import SwiftUI

/// رده‌بندی (LeaderboardS): three tabs, the league's name and the days left, and plain rows with medals for 1–3, my own
/// row tinted, and the green band after the five who move up.
struct LeaderboardScreen: View {
    @Environment(Session.self) private var session

    var body: some View {
        LeaderboardScreenBody(session: session)
    }
}

private struct LeaderboardScreenBody: View {
    @Environment(AppModel.self) private var app
    @Environment(PrivacyStore.self) private var privacy
    @State private var model: LeaderboardModel

    init(session: Session) {
        _model = State(initialValue: LeaderboardModel(session: session))
    }

    private static let tabStyle = SegmentedStyle(track: Tokens.Colors.white, trackRadius: 999, trackPadding: 4, itemRadius: 999, fontSize: 14, vertical: 9, horizontal: nil, spacing: 4)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    BackButton()
                    Text("رده‌بندی").font(.title(32)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
                    Spacer(minLength: 0)
                }
                SegmentedControl(
                    options: LeaderboardModel.Tab.allCases.map { ($0, $0.title) }, selection: $model.tab,
                    style: Self.tabStyle, label: "رده‌بندی", idPrefix: "board"
                )
                .shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 4, x: 0, y: 2)
                content
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task(id: model.tab) { await model.load() }
        .refreshable { await model.load(force: true) }
    }

    @ViewBuilder private var content: some View {
        switch model.phase(of: model.tab) {
        case .loading:
            ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
        case .failed(let message):
            Text(message).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).frame(maxWidth: .infinity).padding(.top, 40)
                .accessibilityIdentifier("boardFailed")
        case .loaded:
            switch model.tab {
            case .league: league
            case .friends: friends
            case .global: global
            }
        }
    }

    // MARK: Tabs

    @ViewBuilder private var league: some View {
        if let standings = model.league {
            LeagueCard(tier: standings.tier, endsAt: standings.endsAt)
            if standings.rows.isEmpty {
                note("هنوز امتیازی نگرفتی. یه دور بازی کن تا وارد لیگ بشی.", id: "leagueEmpty")
            } else {
                BoardCard(items: LeaderboardLayout.league(standings))
            }
        }
    }

    @ViewBuilder private var friends: some View {
        if let standings = model.friends {
            if LeaderboardLayout.hasNoFriends(standings) {
                note("هنوز دوستی نداری. از «پیدا کردن دوست» شروع کن.", id: "friendsEmpty")
                NavigationLink(value: Destination.people) {
                    Text("پیدا کردن دوست").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).frame(maxWidth: .infinity)
                }
                .accessibilityIdentifier("findFriends")
            } else {
                BoardCard(items: LeaderboardLayout.friends(standings))
            }
        }
    }

    @ViewBuilder private var global: some View {
        if let standings = model.global {
            let inGlobal = privacy.settings.inGlobalLeaderboard
            BoardCard(items: LeaderboardLayout.global(standings, inGlobal: inGlobal)) {
                if inGlobal, model.hasMoreGlobal { Task { await model.loadMoreGlobal() } }
            }
            if !inGlobal {
                note("اسمت توی رده‌بندی همه نیست", id: "globalHidden")
                Button {
                    app.select(.me)
                    app.mePath = [.privacy]
                } label: {
                    Text("حریم خصوصی").font(.ui(14, weight: .bold)).foregroundStyle(Tokens.Colors.lapis).frame(maxWidth: .infinity)
                }
                .accessibilityIdentifier("openPrivacy")
            }
        }
    }

    private func note(_ text: String, id: String) -> some View {
        Text(text).font(.ui(14)).foregroundStyle(Tokens.Colors.muted).multilineTextAlignment(.center)
            .frame(maxWidth: .infinity).padding(.top, 20)
            .accessibilityIdentifier(id)
    }
}

/// The amber card: the shield, «لیگ غزل‌باز» and «۳ روز مونده تا آخر هفته».
private struct LeagueCard: View {
    let tier: Int
    let endsAt: String

    var body: some View {
        HStack(spacing: 12) {
            shield
            VStack(alignment: .leading, spacing: 0) {
                Text(LeaderboardLayout.leagueName(tier: tier)).font(.title(24)).lineSpacing(0).foregroundStyle(Tokens.Colors.ink)
                    .accessibilityIdentifier("leagueName")
                if let end = ServerTime.date(from: endsAt) {
                    Text(LeaderboardLayout.daysLeftText(until: end, now: .now)).font(.ui(13, weight: .medium)).foregroundStyle(Tokens.Colors.ink)
                        .accessibilityIdentifier("daysLeft")
                }
            }
            Spacer(minLength: 0)
        }
        .padding(EdgeInsets(top: 7, leading: 9, bottom: 7, trailing: 9))
        .sticker(fill: Tokens.Colors.amber, radius: 24, border: 5, shadow: Tokens.Sticker.Shadow.card)
    }

    /// A lapis shield with two small bars, tilted.
    private var shield: some View {
        ZStack {
            UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 26, bottomTrailingRadius: 26, topTrailingRadius: 14)
                .fill(Tokens.Colors.lapis)
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 26, bottomTrailingRadius: 26, topTrailingRadius: 14).strokeBorder(Tokens.Colors.white, lineWidth: 4))
                .shadow(color: Tokens.Colors.ink.opacity(0.25), radius: 4, x: 0, y: 3)
            HStack(spacing: 3) {
                RoundedRectangle(cornerRadius: 3).fill(Tokens.Colors.white).frame(width: 8, height: 15)
                RoundedRectangle(cornerRadius: 3).fill(Tokens.Colors.fire).frame(width: 8, height: 15)
            }
            .offset(y: -6)
        }
        .frame(width: 48, height: 54)
        .rotationEffect(.degrees(-8))
        .accessibilityHidden(true)
    }
}

/// The white card of rows.
private struct BoardCard: View {
    let items: [LeaderboardItem]
    var reachedEnd: () -> Void = {}

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                switch item {
                case .entry(let entry):
                    BoardRow(entry: entry, last: index == items.count - 1)
                        .onAppear { if index == items.count - 1 { reachedEnd() } }
                case .promoteBand(let count):
                    HStack(spacing: 6) {
                        LineIcon(shape: SVGShape(d: "M12 19V5M5 12l7-7 7 7"), size: 12, lineWidth: 2.8, fill: nil)
                        Text("این \(PersianDigits.string(count)) نفر می‌رن لیگ بالاتر").font(.ui(12, weight: .bold))
                    }
                    .foregroundStyle(Tokens.Colors.ink)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Tokens.Colors.green)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("promoteBand")
                }
            }
        }
        .background(Tokens.Colors.white)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: Tokens.Colors.ink.opacity(0.12), radius: 6, x: 0, y: 3)
        .accessibilityIdentifier("boardRows")
    }
}

private struct BoardRow: View {
    let entry: LeaderboardEntry
    let last: Bool

    var body: some View {
        if let username = entry.opensPerson {
            NavigationLink(value: Destination.person(username)) { row }
                .buttonStyle(.plain)
        } else {
            row
        }
    }

    private var row: some View {
        HStack(spacing: 12) {
            rank
            FaceCircle(parts: entry.avatar, size: 34, plain: entry.isHidden)
            Text(entry.name)
                .font(.ui(15, weight: entry.isMe ? .bold : .regular))
                .foregroundStyle(entry.isMe ? Tokens.Colors.lapis : Tokens.Colors.ink)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(entry.points).font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
        }
        .padding(.horizontal, 16)
        .frame(height: 54)
        .background(entry.isMe ? Tokens.Colors.lapisTint : Color.clear)
        .overlay(alignment: .bottom) { if !last { Tokens.Colors.chipBorder.frame(height: 1) } }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("نفر \(entry.rankText)، \(entry.name)، \(entry.points)")
        .accessibilityIdentifier("boardRow-\(entry.rank)")
    }

    @ViewBuilder private var rank: some View {
        if let medal = entry.medal {
            Text(entry.rankText)
                .font(.title(16)).lineSpacing(0).padding(.top, 3)
                .foregroundStyle(Tokens.Colors.ink)
                .frame(width: 32, height: 32)
                .background(Circle().fill(color(medal)))
                .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                .shadow(color: Tokens.Colors.ink.opacity(0.25), radius: 2.5, x: 0, y: 1)
        } else {
            Text(entry.rankText).font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.muted).frame(width: 32)
        }
    }

    private func color(_ medal: LeaderboardEntry.Medal) -> Color {
        switch medal {
        case .gold: Tokens.Colors.amber
        case .silver: Color(hex: 0xD3D6DE)
        case .bronze: Color(hex: 0xE8955A)
        }
    }
}
