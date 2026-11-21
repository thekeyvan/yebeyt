import SwiftUI

// MARK: - Buttons

struct PressStyle: ButtonStyle {
    var scale: CGFloat = 0.97
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Pill button: primary (accent), plain (sunk) or ghost (outline).
struct PillButton: View {
    enum Kind { case primary, plain, ghost }
    let title: String
    var icon: String? = nil
    var kind: Kind = .plain
    var grow = false
    let action: () -> Void
    @Environment(Prefs.self) private var prefs

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon { AppIcon(icon, size: 15) }
                Text(title).font(.ui(14, .bold))
            }
            .padding(.horizontal, 18)
            .frame(height: 44)
            .frame(maxWidth: grow ? .infinity : nil)
            .foregroundStyle(kind == .primary ? prefs.onAccent : Palette.ink)
            .background {
                switch kind {
                case .primary: Capsule().fill(prefs.accent)
                case .plain: Capsule().fill(Palette.sunk)
                case .ghost: Capsule().stroke(Palette.line, lineWidth: 1)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(PressStyle())
    }
}

/// Round icon button in Liquid Glass.
struct IconButton: View {
    let icon: String
    var size: CGFloat = 44
    var tint: Color = Palette.ink
    var background: Color? = nil
    var label: String = ""
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            AppIcon(icon, size: size * 0.4)
                .foregroundStyle(tint)
                .frame(width: size, height: size)
                .contentShape(Circle())
                .glass(Circle(), interactive: true)
        }
        .buttonStyle(PressStyle(scale: 0.92))
        .accessibilityLabel(label)
    }
}

struct Chip: View {
    let title: String
    var selected = false
    var icon: String? = nil
    let action: () -> Void
    @Environment(Prefs.self) private var prefs
    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let icon { AppIcon(icon, size: 14).foregroundStyle(prefs.accent) }
                Text(title).font(.ui(14, .medium)).lineLimit(1)
            }
            .padding(.horizontal, 16)
            .frame(height: 40)
            .foregroundStyle(selected ? Palette.bg : Palette.ink)
            .background(Capsule().fill(selected ? Palette.ink : Palette.surface))
            .overlay(Capsule().stroke(selected ? Palette.ink : Palette.line, lineWidth: 1))
        }
        .buttonStyle(PressStyle())
    }
}

// MARK: - Text bits

struct SectionTitle<Trailing: View>: View {
    let title: String
    var subtitle: String? = nil
    @ViewBuilder var trailing: Trailing
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.ui(18, .bold)).foregroundStyle(Palette.ink)
            Spacer()
            if let subtitle { Text(subtitle).font(.ui(13, .medium)).foregroundStyle(Palette.muted) }
            trailing
        }
    }
}
extension SectionTitle where Trailing == EmptyView {
    init(_ title: String, subtitle: String? = nil) { self.title = title; self.subtitle = subtitle; trailing = EmptyView() }
}

struct Eyebrow: View {
    let text: String
    var color: Color = Palette.muted
    init(_ text: String, color: Color = Palette.muted) { self.text = text; self.color = color }
    var body: some View { Text(text).font(.ui(12, .bold)).foregroundStyle(color).tracking(0.3) }
}

/// Small sparkle that says "written with AI help".
struct AITag: View {
    @Environment(Router.self) private var router
    var body: some View {
        Button { router.say("این معنی با کمک هوش مصنوعی نوشته شده") } label: {
            AppIcon("sparkle")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Palette.lapis)
                .frame(width: 22, height: 22)
                .background(Circle().fill(Palette.lapisSoft))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("با کمک هوش مصنوعی")
    }
}

/// A couplet in the reading layout: first hemistich to the right, second to the left.
struct CoupletLines: View {
    let couplet: Couplet
    var base: CGFloat = 21
    var stagger = true
    var color: Color = Palette.ink
    var highlight: Int? = nil
    @Environment(Prefs.self) private var prefs
    @Environment(Router.self) private var router

    var body: some View {
        VStack(spacing: 0) {
            line(couplet.m1, 0)
            if !couplet.m2.isEmpty { line(couplet.m2, 1) }
        }
    }

    private func line(_ s: String, _ i: Int) -> some View {
        let size = base * prefs.font.factor * prefs.size
        return BalancedText(text: s, font: prefs.verseFont(base), size: size, rowSpacing: prefs.verseSpacing(base) * 0.5, align: i == 1 && stagger ? 2 : 0)
            .foregroundStyle(color)
            .padding(.vertical, prefs.verseSpacing(base) * 0.25)
            .padding(.horizontal, 4)
            .background(RoundedRectangle(cornerRadius: 8).fill(highlight == i ? prefs.accent.opacity(0.18) : .clear))
    }
}

// MARK: - Rows & avatars

struct PoetAvatar: View {
    let slug: String
    let name: String
    var size: CGFloat = 44
    var body: some View {
        let h = hashHue(slug)
        ZStack {
            Circle().fill(RadialGradient(colors: [Color(h: h, s: 60, l: 52), Color(h: h, s: 55, l: 30)], center: UnitPoint(x: 0.3, y: 0.25), startRadius: 0, endRadius: size))
            if let d = IconData.emblems[slug] {
                Emblem(d: d, size: size * 0.62).foregroundStyle(Color(hex: 0xFFF3DA))
            } else {
                Text(String(name.prefix(1))).font(.ui(size * 0.4, .bold)).foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size)
    }
}

/// A list row with a rounded icon square (the prototype's "song" row).
struct IconRow<Leading: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var leading: Leading
    var action: (() -> Void)? = nil
    var body: some View {
        let row = HStack(spacing: 12) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.ui(14, .bold)).foregroundStyle(Palette.ink).lineLimit(1)
                Text(subtitle).font(.ui(12)).foregroundStyle(Palette.muted).lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        if let action { Button(action: action) { row }.buttonStyle(PressStyle(scale: 0.99)) } else { row }
    }
}

struct IconSquare: View {
    let icon: String
    @Environment(Prefs.self) private var prefs
    var body: some View {
        AppIcon(icon, size: 17)
            .foregroundStyle(prefs.accent)
            .frame(width: 44, height: 44)
            .background(RoundedRectangle(cornerRadius: 12).fill(prefs.accent.opacity(0.18)))
    }
}

struct Fact: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.ui(12)).foregroundStyle(Palette.muted)
            Text(value).font(.ui(14, .bold)).foregroundStyle(Palette.ink).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 16).fill(Palette.surface))
    }
}

struct EmptyNote: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.ui(14)).foregroundStyle(Palette.muted).multilineTextAlignment(.center).lineSpacing(6)
            .frame(maxWidth: .infinity).padding(24)
            .background(RoundedRectangle(cornerRadius: 22).strokeBorder(Palette.line, style: StrokeStyle(lineWidth: 1.5, dash: [6, 5])))
    }
}

struct Note: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View { Text(text).font(.ui(12)).foregroundStyle(Palette.muted).lineSpacing(5).fixedSize(horizontal: false, vertical: true) }
}

// MARK: - Layout helpers

/// Wrapping row of chips (or words). `centered` centres each row; `balanced` evens out row widths
/// so a line never ends with one lonely word.
struct FlowLayout: Layout {
    var spacing: CGFloat = 10
    var centered = false
    var balanced = false
    var rowSpacing: CGFloat? = nil
    /// 0 = leading, 1 = centre, 2 = trailing
    var align = 0

    private func rows(_ subviews: Subviews, maxW: CGFloat) -> [[(Int, CGSize)]] {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        func greedy(_ limit: CGFloat) -> [[(Int, CGSize)]] {
            var out: [[(Int, CGSize)]] = [[]], x: CGFloat = 0
            for (i, sz) in sizes.enumerated() {
                if x + sz.width > limit, !out[out.count - 1].isEmpty { out.append([]); x = 0 }
                out[out.count - 1].append((i, sz)); x += sz.width + spacing
            }
            return out
        }
        var r = greedy(maxW)
        if balanced, r.count > 1 {
            let total = sizes.reduce(0) { $0 + $1.width + spacing }
            var limit = total / CGFloat(r.count)
            while limit < maxW {
                let t = greedy(limit)
                if t.count <= r.count { r = t; break }
                limit += 8
            }
        }
        return r
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        let r = rows(subviews, maxW: maxW)
        var h: CGFloat = 0, w: CGFloat = 0
        for row in r {
            let rw = row.reduce(0) { $0 + $1.1.width } + spacing * CGFloat(max(0, row.count - 1))
            w = max(w, rw); h += (row.map(\.1.height).max() ?? 0)
        }
        h += (rowSpacing ?? spacing) * CGFloat(max(0, r.count - 1))
        return CGSize(width: (centered || align != 0) && maxW.isFinite ? maxW : min(w, maxW), height: h)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        let width = min(bounds.width, proposal.width ?? bounds.width)
        for row in rows(subviews, maxW: width) {
            let rw = row.reduce(0) { $0 + $1.1.width } + spacing * CGFloat(max(0, row.count - 1))
            let a = centered ? 1 : align
            var x = a == 1 ? bounds.minX + (bounds.width - rw) / 2 : a == 2 ? bounds.maxX - rw : bounds.minX
            _ = width
            let rh = row.map(\.1.height).max() ?? 0
            for (i, sz) in row {
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sz))
                x += sz.width + spacing
            }
            y += rh + (rowSpacing ?? spacing)
        }
    }
}

/// A line of verse that wraps evenly (no single word left alone on the last line):
/// one line if it fits, otherwise an even two- or three-line split.
struct BalancedText: View {
    let text: String
    let font: Font
    var size: CGFloat = 20
    var rowSpacing: CGFloat = 4
    /// 0 = leading, 1 = centre, 2 = trailing
    var align = 0

    var body: some View {
        let ta: TextAlignment = align == 1 ? .center : align == 2 ? .trailing : .leading
        let fa: Alignment = align == 1 ? .center : align == 2 ? .trailing : .leading
        ViewThatFits(in: .horizontal) {
            Text(text).fixedSize()
            Text(BalancedText.split(text, 2)).fixedSize()
            Text(BalancedText.split(text, 3)).fixedSize()
            Text(text).fixedSize(horizontal: false, vertical: true)
        }
        .font(font)
        .lineSpacing(rowSpacing)
        .multilineTextAlignment(ta)
        .frame(maxWidth: .infinity, alignment: fa)
    }

    /// Splits words into `n` lines with lengths as even as possible.
    static func split(_ s: String, _ n: Int) -> String {
        let words = s.split(separator: " ").map(String.init)
        guard words.count >= n else { return s }
        let total = words.reduce(0) { $0 + $1.count } + words.count - 1
        var lines: [String] = [], current = "", target = Double(total) / Double(n)
        var remainingLines = n
        for (i, w) in words.enumerated() {
            let candidate = current.isEmpty ? w : current + " " + w
            let wordsLeft = words.count - i
            if !current.isEmpty, remainingLines > 1,
               (abs(Double(candidate.count) - target) > abs(Double(current.count) - target) || wordsLeft < remainingLines) {
                lines.append(current); current = w; remainingLines -= 1
                let used = lines.reduce(0) { $0 + $1.count + 1 }
                target = Double(total - used) / Double(remainingLines)
            } else {
                current = candidate
            }
        }
        lines.append(current)
        return lines.joined(separator: "\n")
    }
}

/// Top bar for pushed screens: back, title, trailing slot.
struct ScreenBar<Trailing: View>: View {
    var title: String = ""
    @ViewBuilder var trailing: Trailing
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        HStack(spacing: 8) {
            IconButton(icon: "chevron.backward", label: "برگشت") { dismiss() }
            Text(title).font(.ui(15, .bold)).foregroundStyle(Palette.ink).lineLimit(1).frame(maxWidth: .infinity)
            trailing.frame(width: 44, height: 44)
        }
        .padding(.horizontal, 12).padding(.top, 6).padding(.bottom, 6)
    }
}
extension ScreenBar where Trailing == Color {
    init(title: String) { self.title = title; trailing = Color.clear }
}

struct Toast: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.ui(14, .medium)).foregroundStyle(Palette.bg)
            .padding(.horizontal, 18).padding(.vertical, 12)
            .background(Capsule().fill(Palette.ink))
            .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
    }
}

extension View {
    /// Liquid Glass on iOS 26, frosted material before that.
    @ViewBuilder func glass<S: Shape>(_ shape: S, tint: Color? = nil, interactive: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            let g: Glass = tint.map { Glass.regular.tint($0) } ?? .regular
            self.glassEffect(interactive ? g.interactive() : g, in: shape)
        } else {
            self.background(tint.map { AnyShapeStyle($0) } ?? AnyShapeStyle(.ultraThinMaterial), in: shape)
        }
    }
    /// Standard horizontal page padding.
    func pagePadding() -> some View { padding(.horizontal, 18) }
    func card(_ radius: CGFloat = 22) -> some View {
        padding(16).frame(maxWidth: .infinity, alignment: .leading).background(RoundedRectangle(cornerRadius: radius).fill(Palette.surface))
    }
}
