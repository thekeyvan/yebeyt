import SwiftUI

/// The mark of a meaning that an AI wrote (only those): a small sparkle by the meaning's heading. Tapping it says
/// where the meaning comes from.
enum AIMeaning {
    static let label = "با کمک هوش مصنوعی"
    static let toast = "این معنی با کمک هوش مصنوعی نوشته شده"
}

/// Our own sparkle: a big four-point star and a small one, in the 24×24 box.
struct SparkleShape: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M10 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9zM18.5 14.5l.9 2.1 2.1 .9-2.1 .9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z").path(in: rect)
    }
}

/// The sparkle button next to a meaning's heading.
struct AISparkleButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            LineIcon(shape: SparkleShape(), size: 16, lineWidth: 1.6, fill: Tokens.Colors.lapis)
                .foregroundStyle(Tokens.Colors.lapis)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, -8)
        .accessibilityLabel(AIMeaning.label)
        .accessibilityIdentifier("aiSparkle")
    }
}

/// The toast that explains the sparkle; it goes by itself.
struct AIToast: View {
    var body: some View {
        Text(AIMeaning.toast)
            .font(.ui(13, weight: .medium))
            .foregroundStyle(Tokens.Colors.white)
            .padding(.horizontal, 16).padding(.vertical, 9)
            .background(Capsule().fill(Tokens.Colors.ink))
            .accessibilityIdentifier("aiToast")
    }
}
