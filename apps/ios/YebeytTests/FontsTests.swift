import Foundation
import Testing
import UIKit
@testable import Yebeyt

@MainActor
struct FontsTests {
    @Test("the four role fonts load from the host app by PostScript name", arguments: Tokens.Fonts.all)
    func fontLoads(token: FontToken) {
        #expect(UIFont(name: token.postScript, size: 17) != nil, "\(token.postScript) is not registered")
    }

    @Test("the four role font files are in the app bundle", arguments: Tokens.Fonts.all)
    func fontFileIsBundled(token: FontToken) {
        #expect(Bundle.main.url(forResource: token.file, withExtension: nil) != nil)
    }

    @Test("the reader's text sheet fonts load by PostScript name", arguments: Tokens.ReaderFonts.all)
    func readerFontLoads(token: FontToken) {
        #expect(UIFont(name: token.postScript, size: 17) != nil, "\(token.postScript) is not registered")
        #expect(Bundle.main.url(forResource: token.file, withExtension: nil) != nil)
    }
}
