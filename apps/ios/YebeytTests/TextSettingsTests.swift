import Foundation
import Testing
import UIKit
@testable import Yebeyt

@MainActor
struct TextSettingsTests {
    private let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!

    @Test func defaultsAreTheBoardsSelectedOptions() {
        let settings = TextSettings()
        #expect(settings.font == .parastoo)
        #expect(settings.bold)
        #expect(settings.layout == .staggered)
        #expect(settings.spacing == .loose)
        #expect(settings.theme == .paper)
        #expect(settings.size == 21)
        #expect(settings.postScript == "Parastoo-Bold")
    }

    @Test func offersTheEightFontsInTheBoardsOrder() {
        #expect(ReaderFont.allCases.map(\.title) == ["پرستو", "نسخ", "نستعلیق", "گندم", "مرکزی", "شبنم", "ساحل", "وزیر"])
    }

    @Test func everyFontIsRegisteredInTheApp() {
        for font in ReaderFont.allCases {
            #expect(UIFont(name: font.postScript(bold: false), size: 17) != nil, "\(font.postScript(bold: false)) is not registered")
        }
        #expect(UIFont(name: "Parastoo-Bold", size: 17) != nil)
    }

    @Test func onlyParastooHasABoldWeight() {
        var settings = TextSettings()
        #expect(settings.canChooseWeight)
        settings.font = .naskh
        #expect(!settings.canChooseWeight)
        #expect(settings.postScript == "NotoNaskhArabic-Regular")
        settings.font = .parastoo
        settings.bold = false
        #expect(settings.postScript == "Parastoo-WOL")
    }

    @Test func onlyParastooIsScaledDown() {
        var settings = TextSettings()
        #expect(settings.glyphScale == 0.84)
        settings.font = .vazir
        #expect(settings.glyphScale == 1)
    }

    @Test func sizeIsKeptInTheSliderRange() {
        var settings = TextSettings()
        settings.size = 99
        #expect(settings.size == TextSettings.sizes.upperBound)
        settings.size = 1
        #expect(settings.size == TextSettings.sizes.lowerBound)
    }

    @Test func lineSpacingGrowsFromTightToLoose() {
        let factors = TextSpacing.allCases.map(\.factor)
        #expect(factors == factors.sorted())
        #expect(TextSpacing.loose.factor == 2.1)
    }

    @Test func storeStartsWithDefaultsAndPersistsChanges() {
        let store = TextSettingsStore(defaults: defaults)
        #expect(store.settings == TextSettings())
        store.settings.font = .gandom
        store.settings.theme = .dark
        store.settings.layout = .centered
        store.settings.spacing = .tight
        store.settings.size = 18
        store.settings.bold = false

        let reopened = TextSettingsStore(defaults: defaults)
        #expect(reopened.settings == store.settings)
        #expect(reopened.settings.font == .gandom)
        #expect(reopened.settings.size == 18)
    }

    @Test func unreadableSavedSettingsFallBackToDefaults() {
        defaults.set(Data("{".utf8), forKey: TextSettingsStore.defaultsKey)
        #expect(TextSettingsStore(defaults: defaults).settings == TextSettings())
    }

    @Test func darkThemeIsPaperTextOnInk() {
        #expect(ReaderTheme.dark.background == Tokens.Colors.ink)
        #expect(ReaderTheme.light.background == Tokens.Colors.white)
    }
}
