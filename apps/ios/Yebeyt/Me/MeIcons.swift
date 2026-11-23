import SwiftUI

// Icons of the Me screens, from the inline SVG paths of the boards Profile, Divan, Privacy, Avatar and
// InviteFriends (24×24 box, never mirrored).

/// تنظیمات
struct GearIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z").path(in: rect)
    }
}

/// ویرایش چهره (the pencil on the face)
struct PencilIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M4 20h4L19 9l-4-4L4 16z").path(in: rect)
    }
}

/// خودم بنویسم
struct WriteIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M4 20l4-1 11-11-3-3L5 16z").path(in: rect)
    }
}

/// A closed padlock: «فقط خودم», the lock badge of a locked item, the privacy note.
struct LockIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.addRoundedRect(in: b.rect(5, 11, 14, 9), cornerSize: CGSize(width: 2 * b.scale, height: 2 * b.scale))
        p.addPath(SVGShape(d: "M8 11V8a4 4 0 0 1 8 0v3").path(in: rect))
        return p
    }
}

/// The badge star (filled when earned, an outline when locked).
struct BadgeStar: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z").path(in: rect)
    }
}

/// پیامک
struct SMSIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z").path(in: rect)
    }
}

/// واتس‌اپ
struct WhatsAppIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1-2z").path(in: rect)
    }
}

/// کپی لینک
struct LinkIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        SVGShape(d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1").path(in: rect)
    }
}

/// بیشتر (three dots)
struct MoreIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        for x in [6.0, 12.0, 18.0] { p.addEllipse(in: b.circle(x, 12, radius: 1.4)) }
        return p
    }
}

/// استوری: a dashed circle with a plus
struct StoryIcon: View {
    var size: CGFloat = 22
    var lineWidth: CGFloat = 2.2

    var body: some View {
        let unit = size / 24
        ZStack {
            Circle()
                .stroke(style: StrokeStyle(lineWidth: lineWidth * unit, lineCap: .round, dash: [3 * unit, 2.2 * unit]))
                .frame(width: 17 * unit, height: 17 * unit)
            LineIcon(shape: SVGShape(d: "M12 8.5v7M8.5 12h7"), size: size, lineWidth: lineWidth, fill: nil)
        }
        .frame(width: size, height: size)
    }
}
