import SwiftUI

/// Our own icons, drawn in a 24×24 box (hand-translated from the SVG paths in design/canvas/gen_explore.py).
/// A shape scales that box to its frame. They are never mirrored in right-to-left (`.fixed`): the paper plane,
/// the magnifier and the flame keep their direction.

/// خونه
struct HomeIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(4, 11))
        p.addLine(to: b.point(12, 4))
        p.addLine(to: b.point(20, 11))
        p.addArc(tangent1End: b.point(20, 21), tangent2End: b.point(15, 21), radius: 1.5 * b.scale)
        p.addLine(to: b.point(15, 21))
        p.addLine(to: b.point(15, 15))
        p.addLine(to: b.point(9, 15))
        p.addLine(to: b.point(9, 21))
        p.addArc(tangent1End: b.point(4, 21), tangent2End: b.point(4, 11), radius: 1.5 * b.scale)
        p.closeSubpath()
        return p
    }
}

/// کاوش
struct ExploreIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.addEllipse(in: b.circle(11, 11, radius: 6.5))
        p.move(to: b.point(16, 16))
        p.addLine(to: b.point(20.5, 20.5))
        return p
    }
}

/// بازی (a game controller; the two buttons are tiny circles that the stroke turns into dots)
struct GamesIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.addRoundedRect(in: b.rect(2.5, 7, 19, 11), cornerSize: CGSize(width: 5 * b.scale, height: 5 * b.scale))
        p.move(to: b.point(7.5, 10.5))
        p.addLine(to: b.point(7.5, 14.5))
        p.move(to: b.point(5.5, 12.5))
        p.addLine(to: b.point(9.5, 12.5))
        p.addEllipse(in: b.circle(15.5, 11.5, radius: 0.7))
        p.addEllipse(in: b.circle(17.5, 13.5, radius: 0.7))
        return p
    }
}

/// پیام‌ها
struct MessagesIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(21, 3))
        p.addLine(to: b.point(10, 14))
        p.move(to: b.point(21, 3))
        p.addLine(to: b.point(14, 21))
        p.addLine(to: b.point(10, 14))
        p.addLine(to: b.point(3, 10))
        p.closeSubpath()
        return p
    }
}

/// The streak flame (filled).
struct FlameShape: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(12, 22))
        p.addCurve(to: b.point(4.5, 14.9), control1: b.point(7.6, 22), control2: b.point(4.5, 19))
        p.addCurve(to: b.point(8.6, 5.8), control1: b.point(4.5, 11.2), control2: b.point(7.3, 9.1))
        p.addCurve(to: b.point(11, 10.8), control1: b.point(10.3, 7.3), control2: b.point(11, 9))
        p.addCurve(to: b.point(13.8, 5.8), control1: b.point(12.5, 9.9), control2: b.point(13.6, 8.2))
        p.addCurve(to: b.point(19.5, 14.9), control1: b.point(16.6, 8), control2: b.point(19.5, 11.2))
        p.addCurve(to: b.point(12, 22), control1: b.point(19.5, 19), control2: b.point(16.4, 22))
        p.closeSubpath()
        return p
    }
}

/// The points star (filled).
struct StarShape: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(12, 2.5))
        for (x, y) in [(14.9, 8.6), (21.6, 9.4), (16.6, 14), (17.9, 20.6), (12, 17.4), (6.1, 20.6), (7.4, 14), (2.4, 9.4), (9.1, 8.6)] {
            p.addLine(to: b.point(x, y))
        }
        p.closeSubpath()
        return p
    }
}
