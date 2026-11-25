#if DEBUG
import SwiftUI

/// The StickerSystem board's sections on dotted paper, for screenshots (`-beytRoute stickers`).
struct StickerSheet: View {
    private let swatches: [(name: String, hex: String, fill: Color, light: Bool)] = [
        ("لاجوردی", "#2F35F5", Tokens.Colors.lapis, true),
        ("آتشی", "#FF4D24", Tokens.Colors.fire, false),
        ("کهربایی", "#FFB703", Tokens.Colors.amber, false),
        ("سبز", "#6CCB3A", Tokens.Colors.green, false),
        ("سرخابی", "#FF3D8B", Tokens.Colors.magenta, false),
        ("مرکب", "#14112B", Tokens.Colors.ink, true),
        ("زمینه", "#F1EFEA", Tokens.Colors.paper, false),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                logo
                colours
                section("حروف") { type }
                section("دکمه و بج") { buttonsAndBadges }
                section("برچسبِ کلمه") { words }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 8)
        }
        .dottedPaper()
    }

    private var logo: some View {
        HStack(spacing: 16) {
            // The board's mark (150×120): lapis on the right, fire on the left, both 76×96. Left-to-right
            // inside so the offsets and tilts are the board's own.
            ZStack {
                blank(Tokens.Colors.lapis, tilt: -7).offset(x: 37, y: -8)
                blank(Tokens.Colors.fire, tilt: 6).offset(x: -37, y: 4)
            }
            .frame(width: 150, height: 120)
            .scaleEffect(0.6)
            .frame(width: 90, height: 72)
            .environment(\.layoutDirection, .leftToRight)
            VStack(alignment: .leading, spacing: 2) {
                Text("یه بیت").font(.title(44)).frame(height: 44 * 0.95)
                Text("هر بیت، یه بازی.").font(.ui(14, weight: .medium))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .stickerCard()
    }

    private func blank(_ colour: Color, tilt: Double) -> some View {
        RoundedRectangle(cornerRadius: 5).fill(Tokens.Colors.white).frame(width: 40, height: 9)
            .frame(width: 76, height: 96)
            .background(RoundedRectangle(cornerRadius: 16).fill(colour).padding(6))
            .background(RoundedRectangle(cornerRadius: 22).fill(Tokens.Colors.white).stickerShadow(ShadowToken(y: 4, blur: 12, opacity: 0.25)))
            .tilted(tilt)
    }

    private var colours: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
            ForEach(swatches, id: \.hex) { swatch in
                VStack(alignment: .leading, spacing: 0) {
                    Text(swatch.name).font(.ui(12, weight: .bold))
                    Text(swatch.hex).font(.ui(9))
                }
                .foregroundStyle(swatch.light ? Tokens.Colors.white : Tokens.Colors.ink)
                .frame(maxWidth: .infinity, minHeight: 26, alignment: .bottomLeading)
                .padding(4)
                .sticker(fill: swatch.fill, radius: Tokens.Sticker.Radius.card, border: Tokens.Sticker.BorderWidth.card, shadow: Tokens.Sticker.Shadow.card)
            }
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.title(24)).frame(height: 24)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(6)
        .stickerCard()
    }

    private var type: some View {
        VStack(alignment: .leading, spacing: 4) {
            specimen("لاله‌زار · تیتر") { Text("کی شاعرِ این بیته؟").font(.title(26)) }
            specimen("پرستو · شعر") { Text("بنی آدم اعضای یکدیگرند").font(.poem(22)) }
            specimen("وزیر · متن") { Text("سارا جوابت رو داد. نوبت توئه، با حرف «د».").font(.ui(14)) }
        }
    }

    private func specimen<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label).font(.ui(11)).foregroundStyle(Tokens.Colors.muted).frame(width: 74, alignment: .leading)
            content()
            Spacer(minLength: 0)
        }
    }

    private var buttonsAndBadges: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Button("بزن بریم") {}.buttonStyle(.sticker(.primary))
                Button("بعداً") {}.buttonStyle(.sticker(.secondary))
            }
            HStack(spacing: 8) {
                StickerBadge(kind: .streak(7))
                StickerBadge(kind: .points(2480))
                StickerBadge(kind: .correct)
            }
            StickerBadge(kind: .decorative("حافظ · تزئینی"))
        }
    }

    private var words: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 2), spacing: 2) {
            ForEach([("روی برگه", WordSticker.Status.onSheet), ("دستته", .held), ("چسبیده", .stuck), ("درست بود", .correct), ("نشد", .wrong)], id: \.0) { label, status in
                VStack(alignment: .leading, spacing: 4) {
                    WordSticker(word: "گوهرند", status: status)
                    Text(label).font(.ui(12)).foregroundStyle(Tokens.Colors.muted)
                }
            }
        }
    }
}
#endif
