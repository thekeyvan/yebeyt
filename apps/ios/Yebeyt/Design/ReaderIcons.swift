import SwiftUI

// The reader's icons, hand-translated from the inline SVG paths of the boards Poem, PoemMeaning,
// PoemScroll and PoemScrollHold (24×24 box, never mirrored). The paper plane (بفرست) is `MessagesIcon`
// and the game controller is `GamesIcon`.

/// The round close button's chevron.
struct ChevronDownIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(6, 9))
        p.addLine(to: b.point(12, 15))
        p.addLine(to: b.point(18, 9))
        return p
    }
}

/// The × of the meaning card.
struct CloseIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(6, 6))
        p.addLine(to: b.point(18, 18))
        p.move(to: b.point(18, 6))
        p.addLine(to: b.point(6, 18))
        return p
    }
}

/// پسند
struct HeartIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(12, 20))
        p.addCurve(to: b.point(4.5, 10), control1: b.point(12, 20), control2: b.point(4.5, 15.4))
        b.arc(&p, from: (4.5, 10), to: (12, 7.4), radius: 4.3, sweep: true)
        b.arc(&p, from: (12, 7.4), to: (19.5, 10), radius: 4.3, sweep: true)
        p.addCurve(to: b.point(12, 20), control1: b.point(19.5, 15.4), control2: b.point(12, 20))
        p.closeSubpath()
        return p
    }
}

/// بازنشر
struct RepostIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(17, 3))
        p.addLine(to: b.point(20, 6))
        p.addLine(to: b.point(17, 9))
        p.move(to: b.point(4, 12))
        p.addLine(to: b.point(4, 9))
        b.arc(&p, from: (4, 9), to: (7, 6), radius: 3, sweep: true)
        p.addLine(to: b.point(20, 6))
        p.move(to: b.point(7, 21))
        p.addLine(to: b.point(4, 18))
        p.addLine(to: b.point(7, 15))
        p.move(to: b.point(20, 12))
        p.addLine(to: b.point(20, 15))
        b.arc(&p, from: (20, 15), to: (17, 18), radius: 3, sweep: true)
        p.addLine(to: b.point(4, 18))
        return p
    }
}

/// نگه دار
struct BookmarkIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(6, 3.5))
        p.addLine(to: b.point(18, 3.5))
        p.addLine(to: b.point(18, 20.5))
        p.addLine(to: b.point(12, 16.5))
        p.addLine(to: b.point(6, 20.5))
        p.closeSubpath()
        return p
    }
}

/// معنی این بیت (an open book)
struct BookIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(4, 5.5))
        b.arc(&p, from: (4, 5.5), to: (5.5, 4), radius: 1.5, sweep: true)
        p.addLine(to: b.point(11, 4))
        p.addLine(to: b.point(11, 20))
        p.addLine(to: b.point(5.5, 20))
        b.arc(&p, from: (5.5, 20), to: (4, 18.5), radius: 1.5, sweep: true)
        p.closeSubpath()
        p.move(to: b.point(20, 5.5))
        b.arc(&p, from: (20, 5.5), to: (18.5, 4), radius: 1.5, sweep: false)
        p.addLine(to: b.point(13, 4))
        p.addLine(to: b.point(13, 20))
        p.addLine(to: b.point(18.5, 20))
        b.arc(&p, from: (18.5, 20), to: (20, 18.5), radius: 1.5, sweep: false)
        p.closeSubpath()
        return p
    }
}

/// بیت به بیت، از همین بیت (corner brackets round two lines)
struct CoupletFocusIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(4, 8))
        p.addLine(to: b.point(4, 5))
        b.arc(&p, from: (4, 5), to: (5, 4), radius: 1, sweep: true)
        p.addLine(to: b.point(8, 4))
        p.move(to: b.point(16, 4))
        p.addLine(to: b.point(19, 4))
        b.arc(&p, from: (19, 4), to: (20, 5), radius: 1, sweep: true)
        p.addLine(to: b.point(20, 8))
        p.move(to: b.point(20, 16))
        p.addLine(to: b.point(20, 19))
        b.arc(&p, from: (20, 19), to: (19, 20), radius: 1, sweep: true)
        p.addLine(to: b.point(16, 20))
        p.move(to: b.point(8, 20))
        p.addLine(to: b.point(5, 20))
        b.arc(&p, from: (5, 20), to: (4, 19), radius: 1, sweep: true)
        p.addLine(to: b.point(4, 16))
        p.move(to: b.point(8, 10.5))
        p.addLine(to: b.point(16, 10.5))
        p.move(to: b.point(9.5, 13.5))
        p.addLine(to: b.point(14.5, 13.5))
        return p
    }
}

/// کپی متن
struct CopyIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.addRoundedRect(in: b.rect(8, 8, 12, 12), cornerSize: CGSize(width: 2.5 * b.scale, height: 2.5 * b.scale))
        p.move(to: b.point(16, 8))
        p.addLine(to: b.point(16, 5.5))
        b.arc(&p, from: (16, 5.5), to: (14.5, 4), radius: 1.5, sweep: false)
        p.addLine(to: b.point(5.5, 4))
        b.arc(&p, from: (5.5, 4), to: (4, 5.5), radius: 1.5, sweep: false)
        p.addLine(to: b.point(4, 14.5))
        b.arc(&p, from: (4, 14.5), to: (5.5, 16), radius: 1.5, sweep: false)
        p.addLine(to: b.point(8, 16))
        return p
    }
}

/// The recitation's play triangle (filled).
struct PlayIcon: Shape {
    var layoutDirectionBehavior: LayoutDirectionBehavior { .fixed }

    func path(in rect: CGRect) -> Path {
        let b = Box(rect)
        var p = Path()
        p.move(to: b.point(7, 4))
        p.addLine(to: b.point(7, 20))
        p.addLine(to: b.point(20, 12))
        p.closeSubpath()
        return p
    }
}
