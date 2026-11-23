import SwiftUI

/// Small pill stickers: streak (fire), points (amber), correct (green), and a decorative tilted one (magenta).
struct StickerBadge: View {
    enum Kind {
        case streak(Int)
        case points(Int)
        case correct
        case decorative(String)
    }

    let kind: Kind

    var body: some View {
        HStack(spacing: 4) {
            switch kind {
            case .streak(let days):
                FlameShape().fill(Tokens.Colors.white).frame(width: 14, height: 14)
                Text(PersianDigits.string(days)).font(.ui(14, weight: .bold))
            case .points(let points):
                StarShape().fill(Tokens.Colors.ink).frame(width: 14, height: 14)
                Text(PersianDigits.grouped(points)).font(.ui(14, weight: .bold))
            case .correct:
                Text("درست بود!").font(.ui(13, weight: .bold))
            case .decorative(let text):
                Text(text).font(.ui(13, weight: .bold))
            }
        }
        .foregroundStyle(textColor)
        .padding(.horizontal, 11)
        .padding(.vertical, 3)
        .sticker(fill: fill, radius: Tokens.Sticker.Radius.pill, border: Tokens.Sticker.BorderWidth.badge, shadow: Tokens.Sticker.Shadow.badge)
        .tilted(tilt)
    }

    private var fill: Color {
        switch kind {
        case .streak: Tokens.Colors.fire
        case .points: Tokens.Colors.amber
        case .correct: Tokens.Colors.green
        case .decorative: Tokens.Colors.magenta
        }
    }

    private var textColor: Color {
        switch kind {
        case .streak, .decorative: Tokens.Colors.white
        case .points, .correct: Tokens.Colors.ink
        }
    }

    private var tilt: Double {
        if case .decorative = kind { Double(Tokens.Sticker.Tilt.decorative) } else { 0 }
    }
}

/// A word on a sticker sheet: loose on the sheet, stuck in place, held in the hand (bigger, tilted, longer shadow) or correct.
struct WordSticker: View {
    enum Status { case onSheet, stuck, held, correct }

    let word: String
    let status: Status

    var body: some View {
        let loose = status == .onSheet
        let held = status == .held
        Text(word)
            .font(.poem(21))
            .fixedSize()
            .foregroundStyle(textColor)
            .padding(EdgeInsets(top: 0, leading: loose ? 14 : 12, bottom: loose ? 4 : 2, trailing: loose ? 14 : 12))
            .sticker(fill: fill, radius: Tokens.Sticker.Radius.word, border: loose ? 0 : Tokens.Sticker.BorderWidth.word, shadow: shadow)
            .scaleEffect(held ? Tokens.Sticker.Scale.held : 1)
            .tilted(held ? Double(Tokens.Sticker.Tilt.word) : 0)
    }

    private var fill: Color {
        switch status {
        case .onSheet: Tokens.Colors.white
        case .stuck: Tokens.Colors.lapis
        case .held: Tokens.Colors.fire
        case .correct: Tokens.Colors.green
        }
    }

    private var textColor: Color {
        switch status {
        case .onSheet, .correct: Tokens.Colors.ink
        case .stuck, .held: Tokens.Colors.white
        }
    }

    private var shadow: ShadowToken {
        switch status {
        case .onSheet: Tokens.Sticker.Shadow.wordOnSheet
        case .stuck, .correct: Tokens.Sticker.Shadow.wordStuck
        case .held: Tokens.Sticker.Shadow.wordHeld
        }
    }
}
