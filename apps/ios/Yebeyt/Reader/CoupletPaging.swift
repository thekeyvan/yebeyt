import CoreGraphics

/// Which couplet the reader is on, and what is near it.
enum CoupletPaging {
    /// A couplet row of the whole-poem list and where it is on screen.
    struct Row: Equatable {
        var index: Int
        var minY: CGFloat
        var maxY: CGFloat
    }

    static func clamp(_ index: Int, count: Int) -> Int {
        max(0, min(index, count - 1))
    }

    static func next(from index: Int, count: Int) -> Int {
        clamp(index + 1, count: count)
    }

    static func previous(from index: Int, count: Int) -> Int {
        clamp(index - 1, count: count)
    }

    /// The faint line above the couplet: the previous couplet's nearest hemistich.
    static func above(_ index: Int, in couplets: [Couplet]) -> String? {
        guard couplets.indices.contains(index - 1) else { return nil }
        let previous = couplets[index - 1]
        return previous.m2.isEmpty ? previous.m1 : previous.m2
    }

    /// The faint line below the couplet: the next couplet's first hemistich.
    static func below(_ index: Int, in couplets: [Couplet]) -> String? {
        couplets.indices.contains(index + 1) ? couplets[index + 1].m1 : nil
    }

    /// The couplet «at the top of the screen» in the whole-poem list (y = 0 is the top of the list):
    /// the first row whose middle is still on screen.
    static func nearestToTop(_ rows: [Row]) -> Int? {
        rows.sorted { $0.index < $1.index }.first { ($0.minY + $0.maxY) / 2 > 0 }?.index ?? rows.map(\.index).max()
    }
}
