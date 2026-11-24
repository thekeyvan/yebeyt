import Foundation
import SwiftUI
import Testing
@testable import Yebeyt

@MainActor
struct MeLaunchTests {
    @Test func theMeRoutesOpenTheMeTabWithThatScreenPushed() {
        let expected: [(String, [Destination])] = [
            ("me", []), ("divan", [.divan]), ("privacy", [.privacy]), ("avatar", [.avatar]),
            ("invite", [.invite]), ("settings", [.settings]), ("badges", [.badges]),
        ]
        for (name, path) in expected {
            let options = LaunchOptions(["beytRoute": name])
            #expect(options.route?.isMe == true, "\(name)")
            #expect(options.mePath == path, "\(name)")
        }
        #expect(LaunchOptions(["beytRoute": "library"]).route?.isMe == false)
        #expect(LaunchOptions(["beytRoute": "library"]).mePath.isEmpty)
    }

    @Test func syncFailsIsAFlagAndFreshAlsoForgetsTheUnsentMarks() {
        #expect(AccountLaunchOptions(["beytSyncFails": "1"]).syncFails)
        #expect(!AccountLaunchOptions([:]).syncFails)
        #expect(LaunchOptions.savedStateKeys.contains(PrivacyStore.unsentKey))
        #expect(LaunchOptions.savedStateKeys.contains(AvatarStore.unsentKey))
    }

    @Test func seedDivanIsAFlag() {
        #expect(LaunchOptions(["beytSeedDivan": "1"]).seedDivan)
        #expect(!LaunchOptions(["beytSeedDivan": "0"]).seedDivan)
        #expect(!LaunchOptions([:]).seedDivan)
    }

    @Test func freshForgetsTheDivanPrivacyFaceAndCounters() {
        let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
        for key in [ReaderMarks.divanKey, PrivacyStore.defaultsKey, AvatarStore.defaultsKey, Achievements.defaultsKey] { defaults.set("x", forKey: key) }
        LaunchOptions.resetSavedState(in: defaults)
        for key in [ReaderMarks.divanKey, PrivacyStore.defaultsKey, AvatarStore.defaultsKey, Achievements.defaultsKey] {
            #expect(defaults.object(forKey: key) == nil, "\(key)")
        }
    }

    @Test func theSeededCoupletsAreRealAndAllLoad() async throws {
        let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
        let marks = ReaderMarks(defaults: defaults)
        marks.seedDivan(now: Date(timeIntervalSince1970: 1_800_000_000))
        #expect(marks.keptItems.count == 20)
        let model = DivanModel()
        await model.load(marks.keptItems, using: try PoetryStore(bundle: Fixtures.appBundle))
        #expect(model.entries.count == 20)
    }

    @Test func thePrivacyAvatarAndInviteScreensAreDrawnWithoutTheTabBar() {
        let model = AppModel(tab: .me)
        #expect(model.showsTabBar)
        for screen in [Destination.privacy, .avatar, .invite] {
            model.mePath = [screen]
            #expect(!model.showsTabBar, "\(screen)")
        }
        for screen in [Destination.divan, .settings, .badges, .licenses] {
            model.mePath = [screen]
            #expect(model.showsTabBar, "\(screen)")
        }
        model.mePath = [.settings, .privacy]
        #expect(!model.showsTabBar)
        let other = AppModel(tab: .home, mePath: [.avatar])
        #expect(other.showsTabBar)
    }

    @Test func tappingTheMeTabAgainGoesBackToTheProfile() {
        let model = AppModel(tab: .me, mePath: [.divan])
        model.select(.me)
        #expect(model.mePath.isEmpty)
    }

    @Test func openingTheReaderClosesAHeldCouplet() {
        let model = AppModel(tab: .me)
        model.hold = HeldCouplet(path: "/a/b/c", index: 0, couplet: Couplet(m1: "a", m2: "b"), caption: "", shareText: "", copyText: "")
        model.openReader(ReaderRoute(path: "/a/b/c"))
        #expect(model.hold == nil)
        #expect(model.reader?.path == "/a/b/c")
    }

    @Test func theMeIconsAreNeverMirrored() {
        #expect(GearIcon().layoutDirectionBehavior == .fixed)
        #expect(PencilIcon().layoutDirectionBehavior == .fixed)
        #expect(LockIcon().layoutDirectionBehavior == .fixed)
        #expect(BadgeStar().layoutDirectionBehavior == .fixed)
        #expect(LinkIcon().layoutDirectionBehavior == .fixed)
        #expect(!GearIcon().path(in: CGRect(x: 0, y: 0, width: 24, height: 24)).isEmpty)
    }

    @Test func theAboutLineHasThePersianVersion() {
        #expect(SettingsScreen.versionLine() == "نسخه‌ی ۲.۰.۰")
        #expect(SettingsScreen.termsURL.absoluteString == "https://yebeyt.com/terms")
        #expect(SettingsScreen.privacyURL.absoluteString == "https://yebeyt.com/privacy")
    }

    @Test func theGateKnowsTheNewFeatures() {
        #expect("برای \(AccountFeature.invite.title) یه حساب لازمه" == "برای دعوت دوستات یه حساب لازمه")
        #expect(AccountFeature(rawValue: "profile") == .profile)
    }
}
