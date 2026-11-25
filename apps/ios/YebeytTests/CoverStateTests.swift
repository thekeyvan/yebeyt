import Testing
@testable import Yebeyt

@Suite("Cover state")
struct CoverStateTests {
    @Test func aCoverGivenAtStartIsAlreadyUpAndCovers() {
        let state = CoverState(item: "reader")
        #expect(state.mounted == "reader")
        #expect(state.risen)
        #expect(state.covers)
    }

    @Test func aNewCoverIsMountedAwayAndRisesOnlyWhenAsked() {
        var state = CoverState<String>(item: nil)
        let rising = state.present("game")
        #expect(!rising)  // mounted below the edge: the rise waits for its first frame
        #expect(state.mounted == "game")
        #expect(!state.risen)
        let generation = state.rise()
        #expect(generation != nil)
        #expect(state.risen)
        #expect(!state.covers)  // not until it is all the way up
        state.finishRise(generation!)
        #expect(state.covers)
        let again = state.rise()
        #expect(again == nil)  // nothing more to do
    }

    @Test func closingWhileItRisesNeverMarksItAsCovering() {
        var state = CoverState<String>(item: nil)
        _ = state.present("game")
        let rise = state.rise()!
        let drop = state.dismiss()!
        state.finishRise(rise)  // the rise's completion arrives late
        #expect(!state.covers, "the tab bar stays")
        state.finishDrop(drop)
        #expect(state.mounted == nil)
    }

    @Test func closingBeforeItEverRoseUnmountsAfterTheDrop() {
        var state = CoverState<String>(item: nil)
        _ = state.present("game")
        let drop = state.dismiss()!
        let late = state.rise()
        #expect(late == nil, "it was asked to go away: the first frame must not raise it")
        state.finishDrop(drop)
        #expect(state.mounted == nil)
    }

    @Test func openingAgainWhileItDropsKeepsItMountedAndRisesFromWhereItIs() {
        var state = CoverState(item: "reader")
        let drop = state.dismiss()!
        let rising = state.present("reader")
        #expect(rising, "it is already mounted: it rises at once")
        let rise = state.rise()!
        state.finishDrop(drop)  // the old drop's completion arrives
        #expect(state.mounted == "reader", "it is not unmounted under the person")
        state.finishRise(rise)
        #expect(state.covers)
    }

    @Test func anotherItemWhileOneIsUpReplacesItInPlace() {
        var state = CoverState(item: "a")
        let rising = state.present("b")
        #expect(!rising)
        #expect(state.mounted == "b")
        #expect(state.risen)
        #expect(state.covers)
    }

    @Test func closingWhatIsNotThereDoesNothing() {
        var state = CoverState<String>(item: nil)
        let drop = state.dismiss()
        #expect(drop == nil)
        #expect(!state.covers)
    }
}
