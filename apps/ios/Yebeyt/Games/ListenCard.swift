import SwiftUI

/// گوش کن: the dark card with the play/pause button, the decorative waveform and what is left to do. The text is not
/// shown; only the first hemistich is heard.
struct ListenCard: View {
    let playing: Bool
    /// How far the clip has played, 0–1: the waveform's bars turn white up to it.
    let progress: Double
    let replaysLeft: Int
    let playOrPause: () -> Void
    let replay: () -> Void

    /// The heights of the bars, as drawn on the board.
    private static let bars: [CGFloat] = [14, 26, 40, 22, 34, 52, 30, 18, 44, 58, 36, 24, 46, 30, 20, 38, 50, 28, 16, 32, 44, 22, 12, 26]

    var body: some View {
        VStack(spacing: 14) {
            Button(action: playOrPause) {
                Group {
                    if playing {
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 3).frame(width: 7, height: 26)
                            RoundedRectangle(cornerRadius: 3).frame(width: 7, height: 26)
                        }
                    } else {
                        PlayIcon().frame(width: 28, height: 28)
                    }
                }
                .foregroundStyle(Tokens.Colors.white)
                .frame(width: 76, height: 76)
                .background(Circle().fill(Tokens.Colors.lapis).shadow(color: Tokens.Colors.lapis.opacity(0.4), radius: 8, x: 0, y: 6))
                .overlay(Circle().strokeBorder(Tokens.Colors.white, lineWidth: 5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(playing ? "مکث" : "پخش")
            .accessibilityIdentifier("listenPlay")
            waveform
            HStack(spacing: 10) {
                Text("متن رو نمی‌بینی، فقط می‌شنوی").font(.ui(12)).foregroundStyle(Color(hex: 0xB9B4C6))
                Button(action: replay) {
                    Text("دوباره بشنو (\(PersianDigits.string(replaysLeft)))").font(.ui(12, weight: .bold)).foregroundStyle(Tokens.Colors.amber)
                }
                .buttonStyle(.plain)
                .disabled(replaysLeft == 0)
                .opacity(replaysLeft == 0 ? 0.5 : 1)
                .accessibilityIdentifier("listenReplay")
            }
        }
        .padding(EdgeInsets(top: 22, leading: 18, bottom: 18, trailing: 18))
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 28).fill(Tokens.Colors.ink).shadow(color: Tokens.Colors.ink.opacity(0.28), radius: 9, x: 0, y: 6)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("listenCard")
    }

    private var waveform: some View {
        HStack(spacing: 4) {
            ForEach(Self.bars.indices, id: \.self) { index in
                let heard = Double(index) < progress * Double(Self.bars.count)
                RoundedRectangle(cornerRadius: 3).fill(Tokens.Colors.white.opacity(heard ? 1 : 0.35)).frame(width: 5, height: Self.bars[index])
            }
        }
        .frame(height: 60)
        .accessibilityHidden(true)
    }
}
