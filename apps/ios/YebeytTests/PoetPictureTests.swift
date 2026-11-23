import Testing
@testable import Yebeyt

struct PoetPictureTests {
    @Test func theDefaultPictureShowsTheFirstLetterOfTheName() {
        #expect(PoetPicture.letter(for: "حافظ") == "ح")
        #expect(PoetPicture.letter(for: "مهدی اخوان ثالث") == "م")
        #expect(PoetPicture.letter(for: "آ") == "آ")
        #expect(PoetPicture.letter(for: "") == "")
    }

    @Test func aPoetsInitialIsTheLetterOfTheirShortName() {
        let poet = LibraryPoet(id: 1, slug: "x", name: "سعدی", tag: "", city: nil, century: nil, color: .fire, bio: "")
        #expect(poet.initial == "س")
    }

    @Test func coverRibbonsFollowTheLibraryBoard() {
        #expect(PaletteColor.lapis.ribbon == .magenta)
        #expect(PaletteColor.fire.ribbon == .amber)
        #expect(PaletteColor.green.ribbon == .lapis)
        #expect(PaletteColor.amber.ribbon == .lapis)
        #expect(PaletteColor.ink.ribbon == .fire)
        #expect(PaletteColor.magenta.ribbon == .amber)
    }
}
