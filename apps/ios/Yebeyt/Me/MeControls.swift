import SwiftUI

/// The white card of the Me screens: radius 22, a soft shadow.
extension View {
    func meCard(radius: CGFloat = 22, shadow: Double = 0.1) -> some View {
        background {
            RoundedRectangle(cornerRadius: radius).fill(Tokens.Colors.white)
                .shadow(color: Tokens.Colors.ink.opacity(shadow), radius: 6, x: 0, y: 3)
        }
    }
}

/// How a `SegmentedControl` looks: the track, the items and the type.
struct SegmentedStyle {
    var track: Color
    var trackRadius: CGFloat
    var trackPadding: CGFloat
    var itemRadius: CGFloat
    var fontSize: CGFloat
    var vertical: CGFloat
    /// nil: each option takes an equal share of the width.
    var horizontal: CGFloat?
    var spacing: CGFloat = 0

    static let divan = SegmentedStyle(track: Tokens.Colors.trackLight, trackRadius: 14, trackPadding: 4, itemRadius: 12, fontSize: 13, vertical: 7, horizontal: nil, spacing: 4)
    static let tone = SegmentedStyle(track: Tokens.Colors.paper, trackRadius: 12, trackPadding: 3, itemRadius: 10, fontSize: 12.5, vertical: 6, horizontal: nil, spacing: 4)
    static let pill = SegmentedStyle(track: Tokens.Colors.paper, trackRadius: 999, trackPadding: 3, itemRadius: 999, fontSize: 12, vertical: 6, horizontal: 11)
}

/// A row of choices where one is on: «شاعر · موضوع · تازه‌ترین», «دوستا · فقط من», the invite tones. The first
/// option sits at the start (the right). The highlight slides from one option to the next (`Motion.bouncy`); give it a
/// `paging` (and the page it swaps `segmentPage`) and that page slides too.
struct SegmentedControl<Value: Hashable>: View {
    let options: [(value: Value, title: String)]
    @Binding var selection: Value
    var style: SegmentedStyle
    var label: String
    /// Each option gets the accessibility identifier `<idPrefix>-<index>`.
    var idPrefix = "segment"
    var paging: SegmentPaging?
    @Namespace private var highlight
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: style.spacing) {
            ForEach(Array(options.enumerated()), id: \.offset) { index, option in
                let on = option.value == selection
                Button { choose(option.value, at: index) } label: {
                    Text(option.title)
                        .font(.ui(style.fontSize, weight: on ? .bold : .medium))
                        .foregroundStyle(on ? Tokens.Colors.white : Tokens.Colors.ink)
                        .transaction { $0.animation = nil }
                        .lineLimit(1)
                        .padding(.vertical, style.vertical)
                        .padding(.horizontal, style.horizontal ?? 0)
                        .frame(maxWidth: style.horizontal == nil ? .infinity : nil)
                        .background {
                            if on {
                                RoundedRectangle(cornerRadius: style.itemRadius).fill(Tokens.Colors.lapis)
                                    .matchedGeometryEffect(id: "on", in: highlight)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
                .accessibilityIdentifier("\(idPrefix)-\(index)")
            }
        }
        .animation(Motion.rises(Motion.variant(reduceMotion: reduceMotion)) ? Motion.bouncy : .easeOut(duration: 0.1), value: selection)
        .padding(style.trackPadding)
        .background(RoundedRectangle(cornerRadius: style.trackRadius).fill(style.track))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
    }

    private func choose(_ value: Value, at index: Int) {
        if let paging, let open = options.firstIndex(where: { $0.value == selection }) {
            paging.select(index, from: open) { selection = value }
        } else {
            selection = value
        }
    }
}

/// The board's switch row: the label at the start, a 50×30 switch at the end (green when on, the knob at the end
/// when on).
struct MeSwitchStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            HStack(spacing: 10) {
                configuration.label
                Spacer(minLength: 0)
                Capsule()
                    .fill(configuration.isOn ? Tokens.Colors.green : Tokens.Colors.ring)
                    .frame(width: 50, height: 30)
                    .overlay(alignment: configuration.isOn ? .trailing : .leading) {
                        Circle().fill(Tokens.Colors.white).frame(width: 24, height: 24)
                            .shadow(color: Tokens.Colors.ink.opacity(0.3), radius: 1.5, x: 0, y: 1)
                            .padding(3)
                    }
                    .animation(.snappy(duration: 0.15), value: configuration.isOn)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityValue(configuration.isOn ? "روشن" : "خاموش")
    }
}
