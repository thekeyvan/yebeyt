import SwiftUI

/// «بیتِ امروز» on the deck: «رد کن» throws the card off with a spring and a tilt before the next one is dealt.
struct DeckCard: View {
    let pick: HomeModel.Pick
    let open: () -> Void
    let send: () -> Void
    let reject: () async -> Void
    @State private var thrown = false

    var body: some View {
        DailyCard(pick: pick, open: open, send: send, reject: { Task { await throwAway() } })
            .thrown(thrown)
    }

    private func throwAway() async {
        guard !thrown else { return }
        withAnimation(Motion.throwAway) { thrown = true }
        try? await Task.sleep(for: .seconds(0.28))
        await reject()
        withAnimation(Motion.bouncy) { thrown = false }  // the same card again if there is no other; a new card has its own state
    }
}
