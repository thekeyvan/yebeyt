import SwiftUI

/// Items in rows that wrap, like a CSS flex-wrap: words of a hemistich, slots, stickers. Right-to-left puts the
/// first item at the right edge. Rows are centred or start-aligned; the layout is as wide as its widest row.
struct WrapLayout: Layout {
    var spacing: CGFloat = 6
    var lineSpacing: CGFloat = 6
    var centered = false
    var rightToLeft = true

    private struct Row {
        var items: [(index: Int, size: CGSize)] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func rows(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows = [Row()]
        for (index, subview) in subviews.enumerated() {
            let size = subview.sizeThatFits(.unspecified)
            let needed = rows[rows.count - 1].items.isEmpty ? size.width : rows[rows.count - 1].width + spacing + size.width
            if needed > width, !rows[rows.count - 1].items.isEmpty { rows.append(Row()) }
            var row = rows.removeLast()
            row.width = row.items.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.items.append((index, size))
            rows.append(row)
        }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = rows(subviews, width: proposal.width ?? .infinity)
        let height = rows.reduce(0) { $0 + $1.height } + CGFloat(max(rows.count - 1, 0)) * lineSpacing
        return CGSize(width: rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(subviews, width: bounds.width) {
            let start = centered ? bounds.midX - row.width / 2 : (rightToLeft ? bounds.maxX - row.width : bounds.minX)
            var x = rightToLeft ? start + row.width : start
            for item in row.items {
                let origin = CGPoint(x: rightToLeft ? x - item.size.width : x, y: y + (row.height - item.size.height) / 2)
                subviews[item.index].place(at: origin, proposal: ProposedViewSize(item.size))
                x += rightToLeft ? -(item.size.width + spacing) : item.size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }
}
