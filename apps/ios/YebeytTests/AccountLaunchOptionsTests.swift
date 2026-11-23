import Foundation
import Testing
@testable import Yebeyt

struct AccountLaunchOptionsTests {
    @Test func onboardingStartsAtTheNamedScreen() {
        for step in OnboardingStep.allCases {
            #expect(AccountLaunchOptions(["beytOnboarding": step.rawValue]).onboarding == step)
        }
        #expect(AccountLaunchOptions(["beytOnboarding": "nope"]).onboarding == nil)
        #expect(AccountLaunchOptions([:]).onboarding == nil)  // a debug launch skips onboarding unless asked
    }

    @Test func theGateOpensForTheNamedFeature() {
        #expect(AccountLaunchOptions(["beytGate": "likes"]).gate == .likes)
        #expect(AccountLaunchOptions(["beytGate": "messages"]).gate == .messages)
        #expect(AccountLaunchOptions(["beytGate": "x"]).gate == nil)
    }

    @Test func flagsAndTheServerAddress() {
        #expect(AccountLaunchOptions(["beytSignedIn": "1"]).signedIn)
        #expect(AccountLaunchOptions(["beytSignedIn": 1]).signedIn)
        #expect(!AccountLaunchOptions(["beytSignedIn": "0"]).signedIn)
        #expect(AccountLaunchOptions(["beytFresh": 1]).fresh)
        #expect(AccountLaunchOptions(["beytAPI": "http://localhost:8080"]).makeAPI().baseURL.absoluteString == "http://localhost:8080")
    }
}
