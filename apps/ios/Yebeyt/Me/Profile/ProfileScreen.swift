import SwiftUI

/// Me (Profile): the face, the name, the stats, the badges and the first couplets of the divan.
struct ProfileScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(Session.self) private var session
    @Environment(AccountModel.self) private var account
    @Environment(AvatarStore.self) private var avatar
    @Environment(GameStats.self) private var stats
    @Environment(MyStats.self) private var myStats
    @Environment(Achievements.self) private var achievements
    @Environment(ReadingProgress.self) private var reading
    @Environment(ReaderMarks.self) private var marks
    @Environment(Library.self) private var library
    @Environment(PoetryStore.self) private var poetry
    @State private var divan = DivanModel()

    private var firstKept: [DivanItem] { Array(marks.keptItems.prefix(2)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                topBar
                identity
                statCards
                badgesCard
                divanSection
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
        .task(id: firstKept.map(\.key)) { await divan.load(firstKept, using: poetry) }
    }

    // MARK: Top

    private var topBar: some View {
        HStack(spacing: 8) {
            Text("من").font(.title(34)).foregroundStyle(Tokens.Colors.ink).accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            Button { account.require(.invite) { model.mePath.append(.invite) } } label: {
                Text("+ دوستاتو بیار")
                    .font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                    .padding(.horizontal, 14).frame(height: 44)
                    .background(Capsule().fill(Tokens.Colors.lapis).shadow(color: Tokens.Colors.lapis.opacity(0.28), radius: 5, x: 0, y: 3))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("inviteFriends")
            RoundButton(label: "تنظیمات", action: { model.mePath.append(.settings) }) {
                LineIcon(shape: GearIcon(), size: 22, lineWidth: 2.2, fill: nil).foregroundStyle(Tokens.Colors.ink)
            }
            .accessibilityIdentifier("settings")
        }
    }

    // MARK: Who

    private var identity: some View {
        HStack(spacing: 16) {
            Button { model.mePath.append(.avatar) } label: {
                ZStack(alignment: .bottomTrailing) {
                    AvatarView(parts: avatar.parts)
                        .padding(4)
                        .background(Circle().fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 4, blur: 14, opacity: 0.18)))
                    LineIcon(shape: PencilIcon(), size: 14, lineWidth: 2.6, fill: nil).foregroundStyle(Tokens.Colors.white)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(Tokens.Colors.lapis))
                        .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 3))
                }
                .frame(width: 104, height: 104)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("ویرایش چهره")
            .accessibilityValue(avatar.parts.spoken)
            .accessibilityIdentifier("editAvatar")
            VStack(alignment: .leading, spacing: 4) {
                Text(name).font(.title(28)).foregroundStyle(Tokens.Colors.ink).lineLimit(1)
                    .accessibilityIdentifier("profileName")
                if session.isSignedIn {
                    if let username = session.user?.username {
                        Text("@\(username)").font(.ui(13)).foregroundStyle(Tokens.Colors.muted)
                            .environment(\.layoutDirection, .leftToRight)
                            .accessibilityIdentifier("profileUsername")
                    }
                } else {
                    signInButton
                }
                if let poet = favouritePoet {
                    Text("شاعرِ محبوب: \(poet)")
                        .font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                        .padding(.horizontal, 10).padding(.vertical, 3)
                        .background(Capsule().fill(Tokens.Colors.white))
                        .padding(.top, 2)
                        .accessibilityIdentifier("favouritePoet")
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var name: String {
        guard session.isSignedIn else { return "مهمان" }
        return session.user?.displayName ?? account.providerName ?? session.user?.username ?? "من"
    }

    private var signInButton: some View {
        Button { account.require(.profile) {} } label: {
            Text("ورود").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 18).padding(.vertical, 5)
                .background(Capsule().fill(Tokens.Colors.lapis))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("profileSignIn")
    }

    private var favouritePoet: String? {
        FavouritePoet.slug(kept: Array(marks.keys(.kept)), read: Array(reading.finished))
            .flatMap { library.poet(slug: $0)?.name }
    }

    // MARK: Stats

    private var statCards: some View {
        HStack(spacing: 10) {
            card(Level.name(points: myStats.points), "سطح", fill: Tokens.Colors.lapis, text: Tokens.Colors.white)
            card(PersianDigits.grouped(myStats.points), "امتیاز", fill: Tokens.Colors.amber, text: Tokens.Colors.ink)
            card("\(PersianDigits.string(myStats.streak)) روز", "پشت‌سرهم", fill: Tokens.Colors.fire, text: Tokens.Colors.white)
        }
        .accessibilityElement(children: .contain)
    }

    private func card(_ value: String, _ label: String, fill: Color, text: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title(20)).lineSpacing(0).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.ui(12, weight: .medium))
        }
        .foregroundStyle(text)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .padding(.horizontal, 4)
        .sticker(fill: fill, radius: 20, border: 4, shadow: ShadowToken(y: 3, blur: 10, opacity: 0.16))
        .accessibilityElement(children: .combine)
    }

    // MARK: Badges

    private var badgesCard: some View {
        VStack(spacing: 10) {
            HStack {
                Text("نشان‌ها").font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                Spacer()
                Button { model.mePath.append(.badges) } label: {
                    Text("همه").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                }
                .accessibilityIdentifier("allBadges")
            }
            .padding(.horizontal, 4)
            HStack(spacing: 6) {
                ForEach(MeBadge.all(BadgeProgress(stats: stats, achievements: achievements, reading: reading))) { BadgeTile(badge: $0) }
            }
        }
        .padding(EdgeInsets(top: 14, leading: 12, bottom: 12, trailing: 12))
        .meCard(shadow: 0.08)
    }

    // MARK: Divan

    private var divanSection: some View {
        VStack(spacing: 10) {
            HStack {
                Button { model.mePath.append(.divan) } label: {
                    Text("دیوانِ من").font(.ui(15, weight: .bold)).foregroundStyle(Tokens.Colors.ink)
                }
                .accessibilityIdentifier("openDivanTitle")
                Spacer()
                if !marks.keptItems.isEmpty {
                    Button { model.mePath.append(.divan) } label: {
                        Text("همه‌ی \(PersianDigits.string(marks.keptItems.count)) بیت").font(.ui(13, weight: .bold)).foregroundStyle(Tokens.Colors.lapis)
                    }
                    .accessibilityIdentifier("openDivan")
                }
            }
            if marks.keptItems.isEmpty {
                Text("هنوز بیتی نگه نداشتی. توی شعرها «نگه دار» رو بزن.")
                    .font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineSpacing(4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .meCard(radius: 18, shadow: 0.08)
            } else {
                HStack(spacing: 10) {
                    ForEach(divan.entries.prefix(2)) { entry in
                        Button { model.openReader(ReaderRoute(path: entry.path, couplet: entry.index)) } label: { miniCard(entry) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("profileCouplet-\(entry.key)")
                    }
                }
            }
        }
    }

    private func miniCard(_ entry: DivanEntry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.couplet.m1).font(.poem(15)).lineSpacing(5).lineLimit(2).multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            Text(library.poet(slug: entry.poetSlug)?.name ?? "").font(.ui(11)).foregroundStyle(Tokens.Colors.muted)
        }
        .foregroundStyle(Tokens.Colors.ink)
        .frame(maxWidth: .infinity, minHeight: 104, maxHeight: 104, alignment: .topLeading)
        .padding(12)
        .meCard(radius: 18, shadow: 0.08)
        .frame(maxWidth: .infinity)
    }
}
