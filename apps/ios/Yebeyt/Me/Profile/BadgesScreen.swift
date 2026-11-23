import SwiftUI

/// A badge sticker: a round coloured sticker with a star, tilted; grey and faded when locked.
struct BadgeSticker: View {
    let badge: MeBadge
    var size: CGFloat = 56

    var body: some View {
        let earned = badge.earned
        let unit = size / 56
        let ink = earned && badge.color == .amber ? Tokens.Colors.ink : Tokens.Colors.white
        let style = StrokeStyle(lineWidth: 2 * unit, lineJoin: .round)
        Circle()
            .fill(earned ? fill : Tokens.Colors.ring)
            .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 4))
            .overlay {
                if earned {
                    BadgeStar().fill(ink).overlay(BadgeStar().stroke(ink, style: style)).frame(width: 24 * unit, height: 24 * unit)
                } else {
                    BadgeStar().stroke(Tokens.Colors.muted, style: style).frame(width: 24 * unit, height: 24 * unit)
                }
            }
            .opacity(earned ? 1 : 0.6)
            .stickerShadow(ShadowToken(y: 2, blur: 8, opacity: 0.18))
            .frame(width: size, height: size)
            .tilted(earned ? badge.tilt : 0)
            .accessibilityHidden(true)
    }

    private var fill: Color {
        switch badge.color {
        case .fire: Tokens.Colors.fire
        case .amber: Tokens.Colors.amber
        case .lapis: Tokens.Colors.lapis
        case .green: Tokens.Colors.green
        }
    }
}

/// A badge with its name under it, for the profile's row.
struct BadgeTile: View {
    let badge: MeBadge

    var body: some View {
        VStack(spacing: 6) {
            BadgeSticker(badge: badge)
            Text(badge.title)
                .font(.ui(11, weight: .bold))
                .foregroundStyle(badge.earned ? Tokens.Colors.ink : Tokens.Colors.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityValue(badge.earned ? "گرفتی" : "قفله")
    }
}

/// «نشان‌ها»: every badge with the rule that earns it.
struct BadgesScreen: View {
    @Environment(GameStats.self) private var stats
    @Environment(Achievements.self) private var achievements
    @Environment(ReadingProgress.self) private var reading

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ScreenHeader(title: "نشان‌ها")
                VStack(spacing: 0) {
                    let badges = MeBadge.all(BadgeProgress(stats: stats, achievements: achievements, reading: reading))
                    ForEach(badges) { badge in
                        HStack(spacing: 14) {
                            BadgeSticker(badge: badge)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(badge.title).font(.ui(15, weight: .bold)).foregroundStyle(badge.earned ? Tokens.Colors.ink : Tokens.Colors.muted)
                                Text(badge.rule).font(.ui(13)).foregroundStyle(Tokens.Colors.muted).lineSpacing(3)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 12)
                        .accessibilityElement(children: .combine)
                        .accessibilityValue(badge.earned ? "گرفتی" : "قفله")
                        if badge.id != badges.last?.id { Tokens.Colors.chipBorder.frame(height: 1) }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 4)
                .meCard(shadow: 0.08)
            }
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .dottedPaper()
        .toolbar(.hidden, for: .navigationBar)
    }
}
