import SwiftUI

// Icons of the library screens, hand-translated from the inline SVG paths of the boards Library, Book,
// BookSection and Poet (24×24 box, never mirrored).

/// The round back button's chevron (points right, towards where right-to-left reading starts).
struct ChevronRightIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(9, 5))
        p.addLine(to: b.point(16, 12))
        p.addLine(to: b.point(9, 19))
        return p
    }
}

/// The chevron at the end of a list row, and the one in «شروع» (points left).
struct ChevronLeftIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(15, 5))
        p.addLine(to: b.point(8, 12))
        p.addLine(to: b.point(15, 19))
        return p
    }
}

/// خوندی
struct CheckIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(5, 12.5))
        p.addLine(to: b.point(9.5, 17))
        p.addLine(to: b.point(19, 7.5))
        return p
    }
}

/// یه غزل تصادفی (a die; the dots are tiny circles that the stroke turns into dots)
struct DiceIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.addRoundedRect(in: b.rect(4, 4, 16, 16), cornerSize: CGSize(width: 4 * b.scale, height: 4 * b.scale))
        for (x, y) in [(9.0, 9.0), (15.0, 15.0), (15.0, 9.0), (9.0, 15.0)] {
            p.addEllipse(in: b.circle(x, y, radius: 1.3))
        }
        return p
    }
}
