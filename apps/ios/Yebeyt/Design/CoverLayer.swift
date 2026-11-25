import SwiftUI

/// What a `CoverLayer` is doing, apart from drawing. Each animation's completion carries the `generation` it was
/// started in and is ignored when something newer has happened since (a close during the rise, an opening during the
/// drop), so a late completion can neither hide the tab bar for a game that is gone nor unmount a cover that came back.
struct CoverState<Item: Equatable>: Equatable {
    private(set) var mounted: Item?
    private(set) var risen: Bool
    /// All the way up, and not on its way down.
    private(set) var covers: Bool
    private(set) var generation = 0
    /// Whether the cover is wanted (the item is set); `mounted` outlives it while the cover drops.
    private var up: Bool

    init(item: Item?) {
        mounted = item
        risen = item != nil
        covers = item != nil
        up = item != nil
    }

    /// Mounts `item`. True when the layer is already there and below the top (it is dropping), so it rises at once;
    /// otherwise a new layer waits for its first frame (`rise`).
    mutating func present(_ item: Item) -> Bool {
        let rising = mounted != nil && !risen
        mounted = item
        up = true
        generation += 1
        return rising
    }

    /// Starts the rise; nil when there is nothing to raise.
    mutating func rise() -> Int? {
        guard up, mounted != nil, !risen else { return nil }
        risen = true
        generation += 1
        return generation
    }

    mutating func finishRise(_ started: Int) {
        if started == generation, up { covers = true }
    }

    /// Starts the drop; nil when nothing is mounted.
    mutating func dismiss() -> Int? {
        up = false
        covers = false
        guard mounted != nil else { return nil }
        risen = false
        generation += 1
        return generation
    }

    mutating func finishDrop(_ started: Int) {
        if started == generation, !up { mounted = nil }
    }
}

/// A full-screen layer over the app (the reader, a game) that rises from the bottom edge and drops back down, as ONE
/// piece: its background, its chrome and its content move with a single offset (`Motion.coverOffset`), so nothing in it
/// is drawn or moved on its own, and nothing inside needs a transition of its own while it moves. (A `.transition` on
/// the cover did not move all of it together: the content stayed in place while the paper wiped in, and the cover just
/// vanished when it went.)
///
/// It rises with a firm spring (`Motion.coverRise`: it settles without going past the top) and drops quickly; under
/// Reduce Motion it crossfades. It stays mounted while it drops (taps go through to nothing), so a sheet that closes with it (the question before leaving a game) goes down in the same
/// motion. `backdrop` is drawn under its bottom edge, so any overshoot shows the cover's own paper, not the page below.
/// A new cover is mounted below the edge first and rises two frames later, so it is drawn there before it moves.
/// `covers` is true from the moment it is all the way up until it starts to go down: what it hides (the tab bar) stays
/// underneath while it moves and can leave once it covers it.
struct CoverLayer<Item: Identifiable & Equatable, Content: View>: View {
    let item: Item?
    let backdrop: Color
    @Binding var covers: Bool
    @ViewBuilder let content: (Item) -> Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var state: CoverState<Item>
    @State private var height = 1000.0

    /// How far the backdrop reaches under the bottom edge.
    private static var reach: Double { 40 }

    init(item: Item?, backdrop: Color, covers: Binding<Bool> = .constant(false), @ViewBuilder content: @escaping (Item) -> Content) {
        self.item = item
        self.backdrop = backdrop
        _covers = covers
        self.content = content
        _state = State(initialValue: CoverState(item: item))  // a screen opened at launch is simply there
    }

    var body: some View {
        let variant = Motion.variant(reduceMotion: reduceMotion)
        ZStack {
            Color.clear.allowsHitTesting(false)
            if let mounted = state.mounted {
                ZStack(alignment: .bottom) {
                    backdrop.frame(height: Self.reach).offset(y: Self.reach)
                    content(mounted).id(mounted.id)
                        .environment(\.feedbackInCover, true)
                        .onAppear { FeedbackPrivacy.shared.coverAppeared() }
                        .onDisappear { FeedbackPrivacy.shared.coverDisappeared() }
                }
                .offset(y: Motion.coverOffset(risen: state.risen, height: height, variant))
                .opacity(Motion.coverOpacity(risen: state.risen, variant))
                .allowsHitTesting(item != nil)
                .accessibilityHidden(item == nil)
                .task { await riseAfterFirstFrame(variant) }
            }
        }
        .onGeometryChange(for: Double.self) { $0.size.height + $0.safeAreaInsets.top + $0.safeAreaInsets.bottom } action: { height = $0 }
        .onAppear { covers = state.covers }
        .onChange(of: item) { _, new in
            if let new {
                Keyboard.dismiss()  // a field under the cover keeps its focus otherwise: the keyboard would stay over the reader
                if state.present(new) { rise(variant) }
            } else {
                drop(variant)
            }
            covers = state.covers
        }
    }

    /// A rise started in the same update as the mounting (`.onAppear`, or no wait at all) is merged with it: the layer is
    /// first drawn already up, with its paper and its content settling separately, which looked like a page drawn in
    /// pieces. Two frames later the layer has been drawn below the edge, and the rise starts from there.
    private func riseAfterFirstFrame(_ variant: Motion.Variant) async {
        try? await Task.sleep(for: .milliseconds(34))
        rise(variant)
    }

    private func rise(_ variant: Motion.Variant) {
        var started: Int?
        withAnimation(Motion.coverRise(variant), completionCriteria: .logicallyComplete) {
            started = state.rise()
        } completion: {
            if let started {
                state.finishRise(started)
                covers = state.covers
            }
        }
    }

    private func drop(_ variant: Motion.Variant) {
        var started: Int?
        withAnimation(Motion.coverDrop(variant), completionCriteria: .logicallyComplete) {
            started = state.dismiss()
        } completion: {
            if let started { state.finishDrop(started) }
        }
    }
}
