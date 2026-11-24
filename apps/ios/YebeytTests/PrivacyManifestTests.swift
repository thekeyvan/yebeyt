import Foundation
import Testing
@testable import Yebeyt

struct PrivacyManifestTests {
    private func manifest() throws -> [String: Any] {
        let url = try #require(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"))
        let data = try Data(contentsOf: url)
        let object = try PropertyListSerialization.propertyList(from: data, format: nil)
        return try #require(object as? [String: Any])
    }

    @Test func theAppDeclaresNoTrackingAndTheDataFeedbackSends() throws {
        let plist = try manifest()
        #expect(plist["NSPrivacyTracking"] as? Bool == false)
        #expect((plist["NSPrivacyTrackingDomains"] as? [Any])?.isEmpty == true)
        let collected = try #require(plist["NSPrivacyCollectedDataTypes"] as? [[String: Any]])
        #expect(Set(collected.compactMap { $0["NSPrivacyCollectedDataType"] as? String }) == [
            "NSPrivacyCollectedDataTypeOtherDiagnosticData", "NSPrivacyCollectedDataTypeProductInteraction", "NSPrivacyCollectedDataTypeOtherUserContent",
        ])
        for entry in collected {
            #expect(entry["NSPrivacyCollectedDataTypeTracking"] as? Bool == false)
            #expect(entry["NSPrivacyCollectedDataTypeLinked"] as? Bool == true)
            #expect(entry["NSPrivacyCollectedDataTypePurposes"] as? [String] == ["NSPrivacyCollectedDataTypePurposeAppFunctionality"])
        }
    }

    @Test func theRequiredReasonApisInUseAreDeclared() throws {
        let plist = try manifest()
        let used = try #require(plist["NSPrivacyAccessedAPITypes"] as? [[String: Any]])
        #expect(used.count == 1)
        #expect(used.first?["NSPrivacyAccessedAPIType"] as? String == "NSPrivacyAccessedAPICategoryUserDefaults")
        #expect(used.first?["NSPrivacyAccessedAPITypeReasons"] as? [String] == ["CA92.1"])
    }
}
