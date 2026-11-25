import SwiftUI

/// The little picture on a catalog card: a tiny mock of the game's core screen, drawn from the shapes of the app
/// (the boards' `MOCK` in design/canvas/gen_games.py, smaller). Decorative: fixed sizes, hidden from VoiceOver.
struct GamePreview: View {
    let kind: GameKind

    var body: some View {
        // The picture is an overlay so its own widths never widen the card.
        Color.clear
            .frame(maxWidth: .infinity)
            .frame(height: 72)
            .overlay { content.padding(.horizontal, 6) }
            .background(RoundedRectangle(cornerRadius: 14).fill(Tokens.Colors.boardPaper))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .accessibilityHidden(true)
    }

    @ViewBuilder private var content: some View {
        switch kind {
        case .daily: daily
        case .jigsaw: jigsaw
        case .poet: poet
        case .misra: misra
        case .book: book
        case .match: match
        case .listen: listen
        case .mosh: mosh
        case .duel: duel
        }
    }

    // MARK: pieces

    private func word(_ text: String, fill: Color = Tokens.Colors.lapis, ink: Color = Tokens.Colors.white, tilt: Double = 0) -> some View {
        Text(text).font(.poem(10, scaled: false)).foregroundStyle(ink).lineLimit(1).fixedSize()
            .padding(.horizontal, 5).padding(.vertical, 1)
            .background(RoundedRectangle(cornerRadius: 7).fill(fill).overlay(RoundedRectangle(cornerRadius: 7).strokeBorder(Tokens.Colors.white, lineWidth: 1.5)))
            .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 2, y: 1)
            .rotationEffect(.degrees(tilt))
    }

    private var slot: some View {
        RoundedRectangle(cornerRadius: 5).strokeBorder(Tokens.Colors.ring, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
            .frame(width: 14, height: 16)
    }

    private func pill(_ text: String, right: Bool = false) -> some View {
        Text(text).font(.poem(9, scaled: false)).lineLimit(1).minimumScaleFactor(0.5)
            .foregroundStyle(Tokens.Colors.ink)
            .padding(.horizontal, 4).padding(.vertical, 2)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 8).fill(right ? Tokens.Colors.green : Tokens.Colors.paper))
    }

    private func letter(_ text: String, filled: Bool) -> some View {
        Text(text).font(.ui(8, weight: .bold, scaled: false)).foregroundStyle(Tokens.Colors.white)
            .frame(width: 14, height: 16)
            .background(RoundedRectangle(cornerRadius: 4).fill(filled ? Tokens.Colors.lapis : Tokens.Colors.white))
            .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Tokens.Colors.lapis, lineWidth: 1.5))
    }

    private func key(_ text: String, used: Bool) -> some View {
        Text(text).font(.ui(8, weight: .bold, scaled: false))
            .foregroundStyle(used ? Tokens.Colors.ring : Tokens.Colors.ink)
            .frame(width: 14, height: 14)
            .background(RoundedRectangle(cornerRadius: 4).fill(used ? Tokens.Colors.paper : Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(used ? 0 : 0.18), radius: 2, y: 1))
    }

    private func circle(_ fill: Color, _ size: CGFloat, ring: Color = Tokens.Colors.white) -> some View {
        Circle().fill(fill).frame(width: size, height: size)
            .overlay(Circle().strokeBorder(ring, lineWidth: 2))
            .shadow(color: Tokens.Colors.ink.opacity(0.18), radius: 2, y: 1)
    }

    // MARK: the nine

    private var daily: some View {
        VStack(spacing: 6) {
            HStack(spacing: 3) {
                letter("م", filled: true); letter("ص", filled: true); letter("", filled: false); letter("", filled: false)
            }
            HStack(spacing: 3) {
                ForEach(Array([("ل", false), ("م", true), ("ر", false), ("ا", false), ("ص", true)].enumerated()), id: \.offset) { _, pair in
                    key(pair.0, used: pair.1)
                }
            }
        }
    }

    private var jigsaw: some View {
        VStack(spacing: 6) {
            HStack(spacing: 3) { word("بنی"); word("آدم"); slot; slot }
            HStack(spacing: 6) {
                word("یکدیگرند", fill: Tokens.Colors.white, ink: Tokens.Colors.ink, tilt: -6)
                word("اعضای", fill: Tokens.Colors.fire, tilt: 5)
            }
        }
    }

    private var poet: some View {
        VStack(spacing: 4) {
            HStack(spacing: 5) {
                ForEach(Array(zip(["حافظ", "سعدی", "مولانا", "خیام"], [Tokens.Colors.lapis, Tokens.Colors.fire, Tokens.Colors.magenta, Tokens.Colors.ink]).enumerated()), id: \.offset) { index, pair in
                    VStack(spacing: 1) {
                        circle(pair.1, 20, ring: index == 2 ? Tokens.Colors.green : Tokens.Colors.white)
                        Text(pair.0).font(.ui(7, weight: index == 2 ? .bold : .medium, scaled: false)).lineLimit(1).minimumScaleFactor(0.6)
                            .foregroundStyle(index == 2 ? Color(hex: 0x3E9A1E) : Tokens.Colors.ink)
                    }
                }
            }
        }
    }

    private var misra: some View {
        VStack(spacing: 4) {
            Text("بنی آدم اعضای یکدیگرند").font(.poem(10, scaled: false)).lineLimit(1).minimumScaleFactor(0.6).foregroundStyle(Tokens.Colors.ink)
            pill("که در آفرینش ز یک گوهرند", right: true)
            pill("که از جان و دل یار یکدیگرند")
        }
    }

    private var book: some View {
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(Array([("مثنوی", Tokens.Colors.amber, 34.0, true), ("دیوان شمس", Tokens.Colors.magenta, 30.0, false), ("فیه ما فیه", Color(hex: 0x1C20B8), 26.0, false)].enumerated()), id: \.offset) { _, item in
                VStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 3).fill(item.1).frame(width: 20, height: item.2)
                        .overlay { if item.3 { RoundedRectangle(cornerRadius: 3).strokeBorder(Tokens.Colors.green, lineWidth: 2.5).padding(-3) } }
                    Text(item.0).font(.ui(7, scaled: false)).lineLimit(1).minimumScaleFactor(0.6).foregroundStyle(Tokens.Colors.ink)
                        .frame(width: 30)
                }
            }
        }
    }

    private var match: some View {
        HStack {
            VStack(spacing: 6) { pill("گلگشت"); pill("مصلا") }
            MatchCurve().stroke(Tokens.Colors.lapis, lineWidth: 1.6).frame(width: 10, height: 30)
            VStack(spacing: 6) { pill("جای نماز"); pill("گردشگاه", right: true) }
        }
    }

    private var listen: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                Circle().fill(Tokens.Colors.lapis).frame(width: 20, height: 20)
                    .overlay(PlayTriangle().fill(Tokens.Colors.white).frame(width: 7, height: 8))
                HStack(spacing: 1.5) {
                    ForEach(Array([5, 9, 14, 8, 12, 16, 7, 11, 15, 8].enumerated()), id: \.offset) { _, height in
                        Capsule().fill(Tokens.Colors.lapis).frame(width: 2, height: CGFloat(height))
                    }
                }
            }
            pill("کنار آب رکن آباد", right: true)
        }
    }

    private var mosh: some View {
        VStack(spacing: 5) {
            Text("یاد باد آن که نهانت").font(.poem(9, scaled: false)).lineLimit(1).minimumScaleFactor(0.6).foregroundStyle(Tokens.Colors.ink)
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(RoundedRectangle(cornerRadius: 9).fill(Tokens.Colors.white))
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("دل می‌رود ز دستم").font(.poem(9, scaled: false)).lineLimit(1).minimumScaleFactor(0.6).foregroundStyle(Tokens.Colors.white)
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(RoundedRectangle(cornerRadius: 9).fill(Tokens.Colors.lapis))
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private var duel: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                circle(Tokens.Colors.amber, 24)
                Text("۳").font(.title(16, scaled: false))
                Text("۲").font(.title(16, scaled: false))
                circle(Tokens.Colors.magenta, 24)
            }
            .foregroundStyle(Tokens.Colors.ink)
            HStack(spacing: 3) {
                ForEach(Array([Tokens.Colors.green, Tokens.Colors.fire, Tokens.Colors.green, Tokens.Colors.green, Tokens.Colors.ring].enumerated()), id: \.offset) { _, color in
                    Capsule().fill(color).frame(width: 12, height: 5)
                }
            }
        }
    }
}

/// The line of the معنی‌یاب preview, from the top of one word's side to the bottom of the other's.
private struct MatchCurve: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.15))
        path.addCurve(
            to: CGPoint(x: rect.minX, y: rect.maxY - rect.height * 0.15),
            control1: CGPoint(x: rect.midX, y: rect.minY + rect.height * 0.15),
            control2: CGPoint(x: rect.midX, y: rect.maxY - rect.height * 0.15)
        )
        return path
    }
}

private struct PlayTriangle: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
