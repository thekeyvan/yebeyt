import SwiftUI

/// A full-screen layer over the app (the reader, a game) that rises from the bottom edge and drops back down, as ONE
/// piece: its background, its chrome and its content move with a single offset (`Motion.coverOffset`), so nothing in it
/// is drawn or moved on its own, and nothing inside needs a transition of its own while it moves. (A `.transition` on
/// the cover did not move all of it together: the content stayed in place while the paper wiped in, and the cover just
/// vanished when it went.)
///
/// It rises with `bouncy` and drops quickly; under Reduce Motion it crossfades. It stays mounted while it drops (taps
/// go through to nothing), so a sheet that closes with it (the question before leaving a game) goes down in the same
/// motion. `backdrop` is drawn under its bottom edge, so the spring's overshoot shows the cover's own paper, not the
/// page below. `covers` is true from the moment it is all the way up until it starts to go down: what it hides (the
/// tab bar) stays underneath while it moves and can leave once it covers it.
struct CoverLayer<Item: Identifiable & Equatable, Content: View>: View {
    let item: Item?
    let backdrop: Color
    @Binding var covers: Bool
    @ViewBuilder let content: (Item) -> Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var mounted: Item?
    @State private var risen: Bool
    @State private var height = 1000.0

    /// How far the backdrop reaches under the bottom edge: more than the spring overshoots.
    private static var reach: Double { 160 }

    init(item: Item?, backdrop: Color, covers: Binding<Bool> = .constant(false), @ViewBuilder content: @escaping (Item) -> Content) {
        self.item = item
        self.backdrop = backdrop
        _covers = covers
        self.content = content
        _mounted = State(initialValue: item)
        _risen = State(initialValue: item != nil)  // a screen opened at launch is simply there
    }

    var body: some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        ZStack {
            Color.clear.allowsHitTesting(false)
            if let mounted {
                ZStack(alignment: .bottom) {
                    backdrop.frame(height: Self.reach).offset(y: Self.reach)
                    content(mounted).id(mounted.id)
                }
                .offset(y: Motion.coverOffset(risen: risen, height: height, variant))
                .opacity(Motion.coverOpacity(risen: risen, variant))
                .allowsHitTesting(item != nil)
                .accessibilityHidden(item == nil)
            }
        }
        .onGeometryChange(for: Double.self) { $0.size.height + $0.safeAreaInsets.top + $0.safeAreaInsets.bottom } action: { height = $0 }
        .onAppear { covers = item != nil }
        .onChange(of: item) { _, new in
            if let new { present(new, variant) } else { dismiss(variant) }
        }
    }

    private func present(_ new: Item, _ variant: Motion.Variant) {
        mounted = new
        guard !risen else { return }  // another item replaces the one that is up; one that is still dropping comes back up
        // Mounted away first, then moved: a tick later, so the first frame is the one below the edge.
        Task {
            withAnimation(Motion.coverRise(variant), completionCriteria: .logicallyComplete) {
                risen = true
            } completion: {
                covers = item != nil
            }
        }
    }

    private func dismiss(_ variant: Motion.Variant) {
        covers = false
        withAnimation(Motion.coverDrop(variant), completionCriteria: .logicallyComplete) {
            risen = false
        } completion: {
            if item == nil, !risen { mounted = nil }
        }
    }
}
