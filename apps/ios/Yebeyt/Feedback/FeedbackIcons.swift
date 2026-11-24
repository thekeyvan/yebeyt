import SwiftUI

// The icons of the feedback boards (FeedbackShake, FeedbackBug): 24×24 box, never mirrored. The heart is
// `HeartIcon`, the game controller `GamesIcon`, the pencil `WriteIcon`, the close cross `CloseIcon`.

/// باگ دیدم
struct BugIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M7 13a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0zM9 8a3 3 0 0 1 6 0M4 12h3M17 12h3M4.5 7.5l2.8 2M19.5 7.5l-2.8 2M4.5 17.5l2.8-1.5M19.5 17.5l-2.8-1.5M12 12v6").path(in: rect)
    }
}

/// یه ایده دارم (a light bulb)
struct IdeaIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z").path(in: rect)
    }
}

/// یه جاش اذیتم کرد (a speech bubble with an exclamation mark)
struct ComplaintIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM12 8.5V12M12 14.6v.1").path(in: rect)
    }
}

/// «دوباره انجامش بده، ما فیلم می‌گیریم»: a record button, a ring with a dot (the dot is filled by the view).
struct RecordRing: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        Path(ellipseIn: Box(rect).circle(12, 12, radius: 8))
    }
}

struct RecordDot: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        Path(ellipseIn: Box(rect).circle(12, 12, radius: 3.5))
    }
}

/// The unit of a bug's record button: the ring and its filled dot.
struct RecordGlyph: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            LineIcon(shape: RecordRing(), size: size, lineWidth: 2.4, fill: nil)
            RecordDot().fill().frame(width: size, height: size)
        }
    }
}

extension FeedbackType {
    /// The colour of the round icon on the sheet.
    var tint: Color {
        switch self {
        case .bug: Tokens.Colors.fire
        case .annoyed: Tokens.Colors.ink
        case .idea: Tokens.Colors.amber
        case .game: Tokens.Colors.lapis
        case .liked: Tokens.Colors.magenta
        }
    }

    /// The icon on `tint`: white, except on amber.
    var iconColor: Color { self == .idea ? Tokens.Colors.ink : Tokens.Colors.white }

    @ViewBuilder var icon: some View {
        switch self {
        case .bug: LineIcon(shape: BugIcon(), size: 22, lineWidth: 2.3, fill: nil)
        case .annoyed: LineIcon(shape: ComplaintIcon(), size: 22, lineWidth: 2.3, fill: nil)
        case .idea: LineIcon(shape: IdeaIcon(), size: 22, lineWidth: 2.3, fill: nil)
        case .game: LineIcon(shape: GamesIcon(), size: 22, lineWidth: 2.3, fill: nil)
        case .liked: LineIcon(shape: HeartIcon(), size: 22, lineWidth: 2.3, fill: nil)
        }
    }
}
