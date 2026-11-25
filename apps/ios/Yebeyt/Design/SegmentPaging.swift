import SwiftUI

/// What a `SegmentedControl` swaps slides like the tab pages (`Motion.tab`): the new page comes in from the side of its
/// segment and the old one leaves the other way, both with `bouncy`. The control and the page share one `SegmentPaging`.
///
/// A page that is taken away is drawn with what it knew last, so the control first announces the way (the page learns
/// which way it goes), and one tick later makes the switch: the same two steps as the tab bar's `arriving`.
@MainActor @Observable
final class SegmentPaging {
    /// +1 toward a later segment, -1 toward an earlier one, 0 when none is on its way. It stays after the switch until
    /// the next announcement, for the pages that are still moving.
    private(set) var direction = 0

    func announce(_ index: Int, from current: Int) {
        direction = index > current ? 1 : index < current ? -1 : 0
    }

    func incoming(_ variant: Motion.Variant) -> Motion.Arrival {
        Motion.pageArrival(from: 0, to: direction, variant)
    }

    func outgoing(_ variant: Motion.Variant) -> Motion.Arrival {
        Motion.departure(of: incoming(variant))
    }

    /// The control's tap: announces, then (a tick later, when the old page has been told) applies the change.
    func select(_ index: Int, from current: Int, apply: @escaping () -> Void) {
        announce(index, from: current)
        Task { apply() }
    }
}

extension View {
    /// The page a `SegmentedControl` with the same `paging` swaps: one view (put several in a stack first), as wide as
    /// the space it is given. `selection` is what tells the pages apart (it should change when the page's content does).
    func segmentPage(_ paging: SegmentPaging, selection: some Hashable) -> some View {
        modifier(SegmentPage(paging: paging, selection: selection))
    }
}

private struct SegmentPage<Selection: Hashable>: ViewModifier {
    let paging: SegmentPaging
    let selection: Selection
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        ZStack(alignment: .topLeading) {
            content
                .id(selection)
                .transition(Motion.tab(incoming: paging.incoming(variant), outgoing: paging.outgoing(variant), variant))
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .animation(Motion.bouncy, value: selection)
    }
}
