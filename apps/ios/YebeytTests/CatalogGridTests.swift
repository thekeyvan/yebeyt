import Testing
import SwiftUI
@testable import Yebeyt

struct CatalogGridTests {
    @Test func theGridHasThreeColumnsAtTheDefaultSizeAndFewerAsTextGrows() {
        #expect(GamesCatalogScreen.columns(for: .large) == 3)
        #expect(GamesCatalogScreen.columns(for: .xSmall) == 3)
        #expect(GamesCatalogScreen.columns(for: .xLarge) == 2)
        #expect(GamesCatalogScreen.columns(for: .xxxLarge) == 2)
        #expect(GamesCatalogScreen.columns(for: .accessibility1) == 1)
        #expect(GamesCatalogScreen.columns(for: .accessibility3) == 1)
    }

    @Test func theRowsFillFromTheFirstGameAndNoGameIsLost() {
        for columns in 1...3 {
            let rows = GamesCatalogScreen.rows(GameKind.allCases, columns: columns)
            #expect(rows.flatMap { $0 } == GameKind.allCases)
            #expect(rows.dropLast().allSatisfy { $0.count == columns })
        }
        #expect(GamesCatalogScreen.rows(GameKind.allCases, columns: 3).first == [.daily, .jigsaw, .poet])
    }
}
