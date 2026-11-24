import Foundation
import Testing
import UIKit
@testable import Yebeyt

@MainActor
struct FeedbackPayloadTests {
    private let device = DeviceInfo(appVersion: "2.0.0", deviceModel: "iPhone17,1", osVersion: "26.0")

    private func info(network: NetworkKind = .wifi) -> TechnicalInfo {
        TechnicalInfo(
            screen: .reader, couplet: "/hafez/ghazal/sh3#2", mode: "بیت به بیت", recitationPosition: 12.5,
            textSettings: TextSettings().technicalValues, network: network, accountState: .guest,
            recentErrors: ["429 rate_limited"], steps: [.home, .explore, .reader]
        )
    }

    private func body(_ type: FeedbackType, edit: (inout FeedbackDraft) -> Void = { _ in }) throws -> [String: Any] {
        var draft = FeedbackDraft(type: type)
        draft.text = "  نوشته  "
        edit(&draft)
        let data = try JSONEncoder().encode(FeedbackPayload(draft: draft, info: info(), device: device))
        let object = try JSONSerialization.jsonObject(with: data)
        return try #require(object as? [String: Any])
    }

    @Test func aBugCarriesTheTextFrequencyScreenAndTechnicalInfo() throws {
        let json = try body(.bug) { $0.frequency = .once }
        #expect(json["type"] as? String == "bug")
        #expect(json["text"] as? String == "نوشته")
        #expect(json["frequency"] as? String == "once")
        #expect(json["screen"] as? String == "خوندن شعر")
        #expect(json["technical"] is [String: Any])
        #expect(json["game"] == nil)
        #expect(Set(json.keys) == ["type", "text", "frequency", "screen", "technical", "appVersion", "deviceModel", "osVersion"])
    }

    @Test func anAnnoyingThingCarriesTheScreenNameButNoTechnicalInfo() throws {
        let json = try body(.annoyed)
        #expect(Set(json.keys) == ["type", "text", "screen", "appVersion", "deviceModel", "osVersion"])
        #expect(json["screen"] as? String == "خوندن شعر")
    }

    @Test func ideasAndThanksCarryOnlyTheText() throws {
        for type in [FeedbackType.idea, .liked] {
            let json = try body(type)
            #expect(Set(json.keys) == ["type", "text", "appVersion", "deviceModel", "osVersion"])
        }
    }

    @Test func aGameIdeaCarriesTheGameAndNoText() throws {
        let json = try body(.game) { $0.gameName = " بیت عوضی "; $0.players = .both }
        #expect(Set(json.keys) == ["type", "game", "appVersion", "deviceModel", "osVersion"])
        let game = try #require(json["game"] as? [String: Any])
        #expect(game["name"] as? String == "بیت عوضی")
        #expect(game["how"] as? String == "نوشته")
        #expect(game["players"] as? String == "both")
        let noName = try body(.game)  // the name is optional
        #expect((noName["game"] as? [String: Any])?["name"] == nil)
    }

    @Test func everyTypeSendsTheAppVersionPhoneModelAndSystemVersion() throws {
        for type in FeedbackType.allCases {
            let json = try body(type)
            #expect(json["appVersion"] as? String == "2.0.0")
            #expect(json["deviceModel"] as? String == "iPhone17,1")
            #expect(json["osVersion"] as? String == "26.0")
        }
        #expect(!DeviceInfo.machineID().isEmpty)
        #expect(DeviceInfo.current().appVersion.count <= 20)
    }

    @Test func theSendButtonWaitsForTheRequiredText() {
        for type in FeedbackType.allCases {
            var draft = FeedbackDraft(type: type)
            #expect(!draft.canSend)
            draft.text = "  \n "
            #expect(!draft.canSend)
            draft.text = "ب"
            #expect(draft.canSend)
        }
        var long = FeedbackDraft(type: .idea)
        long.text = String(repeating: "ا", count: 3000)
        #expect(long.trimmedText.count == FeedbackDraft.textLimit)  // the server takes 2000
    }

    @Test func theScreenshotSwitchStartsAsTheTableSays() {
        #expect(FeedbackDraft(type: .bug).screenshotOn)
        #expect(FeedbackDraft(type: .annoyed).screenshotOn)
        #expect(!FeedbackDraft(type: .idea).screenshotOn)
        #expect(FeedbackType.idea.takesScreenshot)
        #expect(!FeedbackType.game.takesScreenshot && !FeedbackType.liked.takesScreenshot)
        var game = FeedbackDraft(type: .game)
        game.screenshotOn = true
        #expect(!game.sendsScreenshot)
        #expect(FeedbackType.bug.takesRecording && !FeedbackType.annoyed.takesRecording)
    }
}

@MainActor
struct TechnicalInfoTests {
    private func sample(errors: [String] = [], steps: [ScreenName] = []) -> TechnicalInfo {
        TechnicalInfo(
            screen: .reader, couplet: "/hafez/ghazal/sh3#0", mode: "کل شعر", recitationPosition: 3,
            textSettings: TextSettings().technicalValues, network: .cellular, accountState: .signedIn, recentErrors: errors, steps: steps
        )
    }

    private func keys(_ info: TechnicalInfo) throws -> [String: Any] {
        let data = try JSONEncoder().encode(info)
        let object = try JSONSerialization.jsonObject(with: data)
        return try #require(object as? [String: Any])
    }

    @Test func itHasOnlyTheKeysTheServerAllows() throws {
        let json = try keys(sample(errors: ["network"], steps: [.home]))
        #expect(Set(json.keys) == TechnicalInfo.allowedKeys)
        #expect(Set(try keys(sample()).keys).isSubset(of: TechnicalInfo.allowedKeys))
        #expect(try keys(sample())["steps"] == nil)  // empty lists are left out
    }

    @Test func theContractsValuesComeOutAsWritten() throws {
        let json = try keys(sample())
        #expect(json["network"] as? String == "cellular")
        #expect(json["accountState"] as? String == "signedIn")
        #expect(json["recitationPosition"] as? Double == 3)
        let settings = try #require(json["textSettings"] as? [String: Any])
        #expect(Set(settings.keys) == ["size", "font", "bold", "layout", "spacing", "theme"])
        #expect(settings["size"] as? Int == 21)
        #expect(settings["bold"] as? Bool == true)
        #expect((settings.values.compactMap { $0 as? String }).allSatisfy { $0.count <= 40 })
    }

    @Test func stepsAreScreenNamesOnlyAndBothListsStopAtTwenty() throws {
        let many = (0..<40).map { _ in ScreenName.allCases.randomElement()! }
        let errors = (0..<40).map { "500 error\($0)" }
        let json = try keys(sample(errors: errors, steps: many))
        let steps = try #require(json["steps"] as? [String])
        #expect(steps.count == 20)
        #expect(steps.allSatisfy { ScreenName(rawValue: $0) != nil })
        #expect((json["recentErrors"] as? [String])?.count == 20)
        #expect((json["recentErrors"] as? [String])?.last == "500 error39")
    }

    @Test func coupletKeysFollowTheContractsPattern() {
        #expect(TechnicalInfo.coupletKey(path: "/hafez/ghazal/sh3", index: 0) == "/hafez/ghazal/sh3#0")
        #expect(TechnicalInfo.coupletKey(path: "/saadi/ghazal/sh12", index: 25) == "/saadi/ghazal/sh12#25")
        #expect(TechnicalInfo.coupletKey(path: "/حافظ/غزل", index: 1) == nil)  // not a path the server accepts: left out
        #expect(TechnicalInfo.coupletKey(path: "hafez", index: 1) == nil)
        #expect(TechnicalInfo.coupletKey(path: "/hafez", index: 100000) == nil)
    }

    @Test func theListUnderSeeWhatItIsShowsWhatIsSent() throws {
        let info = sample(errors: ["429 rate_limited"], steps: [.home, .reader])
        let rows = info.rows
        let labels = rows.map(\.label)
        #expect(labels.first == "صفحه")
        #expect(labels.contains("بیت") && labels.contains("حالت خوندن") && labels.contains("جای خوانش") && labels.contains("اینترنت") && labels.contains("حساب"))
        #expect(rows.first { $0.label == "خطاهای اخیر" }?.value == "429 rate_limited")
        #expect(rows.first { $0.label == "کارهای قبلش" }?.value == "خونه، خوندن شعر")
        #expect(rows.first { $0.label == "جای خوانش" }?.value == "۳ ثانیه")
        #expect(rows.first { $0.label == "متن · اندازه" }?.value == "۲۱")
        #expect(rows.first { $0.label == "حساب" }?.value == "واردشده")
        let bare = TechnicalInfo(screen: .home, textSettings: [:], network: .offline, accountState: .guest, recentErrors: [], steps: [])
        #expect(bare.rows.map(\.label) == ["صفحه", "اینترنت", "حساب", "خطاهای اخیر", "کارهای قبلش"])
    }

    @Test func theNetworkKindComesFromThePath() {
        #expect(NetworkKind(satisfied: false, wifi: true, cellular: false) == .offline)
        #expect(NetworkKind(satisfied: true, wifi: true, cellular: false) == .wifi)
        #expect(NetworkKind(satisfied: true, wifi: false, cellular: true) == .cellular)
        #expect(NetworkKind(satisfied: true, wifi: false, cellular: false) == .unknown)
    }
}

@MainActor
struct FeedbackLogTests {
    @Test func theStepRingKeepsTheLastTwentyScreenNamesAndSkipsRepeats() {
        let log = FeedbackLog()
        log.visit(.home)
        log.visit(.home)
        #expect(log.steps == [.home])
        for index in 0..<30 { log.visit(index.isMultiple(of: 2) ? .explore : .games) }
        #expect(log.steps.count == FeedbackLog.limit)
        #expect(log.steps.last == .games)
    }

    @Test func theErrorRingKeepsTheLastTwentyCodesAndNoMessages() {
        let log = FeedbackLog()
        for status in 400..<430 { log.record(.server(status: status, code: .rateLimited, allowedAt: "secret")) }
        #expect(log.errors.count == 20)
        #expect(log.errors.last == "429 rate_limited")
        log.record(.network)
        log.record(.badResponse)
        log.record(.server(status: 418, code: nil, allowedAt: nil))
        log.record(.busy(retryAfter: 3))
        #expect(Array(log.errors.suffix(4)) == ["network", "bad_response", "418 unknown", "503 busy"])
        #expect(!log.errors.joined().contains("secret"))
    }

    @Test func showingAnErrorLineNotesItsCode() {
        let log = FeedbackLog()
        let line = log.shown(.network)
        #expect(line == APIError.network.persianMessage)
        #expect(log.errors == ["network"])
    }
}

@MainActor
struct ScreenshotTests {
    private func picture(_ width: CGFloat, _ height: CGFloat, scale: CGFloat = 1) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        return UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format).image { context in
            UIColor.systemTeal.setFill()
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
            UIColor.white.setFill()
            context.fill(CGRect(x: width / 4, y: height / 4, width: width / 2, height: height / 2))
        }
    }

    @Test func aBigPictureIsScaledToSixteenHundredOnItsLongSideAndMadeAJPEG() throws {
        let data = try #require(ScreenshotEncoder.jpeg(from: picture(1179, 2556)))
        #expect(Array(data.prefix(3)) == [0xFF, 0xD8, 0xFF])  // what the server checks
        #expect(data.count <= ScreenshotEncoder.maxBytes)
        let decoded = try #require(UIImage(data: data))
        #expect(max(decoded.size.width * decoded.scale, decoded.size.height * decoded.scale) == 1600)
        #expect(abs(decoded.size.width / decoded.size.height - 1179.0 / 2556.0) < 0.01)
    }

    @Test func theScaleOfTheScreenCountsAndASmallPictureIsNotEnlarged() throws {
        let retinaData = try #require(ScreenshotEncoder.jpeg(from: picture(390, 844, scale: 3)))
        let retina = try #require(UIImage(data: retinaData))
        #expect(retina.size.height * retina.scale == 1600)
        let smallData = try #require(ScreenshotEncoder.jpeg(from: picture(300, 600)))
        let small = try #require(UIImage(data: smallData))
        #expect(small.size.height * small.scale == 600)
    }

    @Test func aPictureThatWillNotFitIsRefusedNotSentBig() {
        #expect(ScreenshotEncoder.jpeg(from: picture(1179, 2556), maxBytes: 100) == nil)
    }

    @Test func coverRectanglesAndLinesAreDrawnInInkAndUndoTakesThemBack() throws {
        let base = picture(100, 200)
        var markup = ScreenshotMarkup()
        #expect(markup.isEmpty)
        #expect(markup.render(on: base) === base)
        markup.add(.cover(CGRect(x: 0.4, y: 0.4, width: 0.2, height: 0.2)))
        markup.add(.line([CGPoint(x: 0.1, y: 0.1025), CGPoint(x: 0.9, y: 0.1025)]))
        let drawn = markup.render(on: base)
        #expect(drawn.size == base.size)
        #expect(Self.pixel(drawn, x: 50, y: 100) == [0x14, 0x11, 0x2B])  // the middle of the cover is ink
        #expect(Self.pixel(drawn, x: 50, y: 20) == [0x14, 0x11, 0x2B])  // so is the line
        #expect(Self.pixel(drawn, x: 5, y: 150) != [0x14, 0x11, 0x2B])
        markup.undo()
        markup.undo()
        markup.undo()  // nothing left: no harm
        #expect(markup.isEmpty)
    }

    private static func pixel(_ image: UIImage, x: Int, y: Int) -> [UInt8] {
        guard let cg = image.cgImage else { return [] }
        let scale = image.scale
        var bytes = [UInt8](repeating: 0, count: 4)
        let context = CGContext(data: &bytes, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        context?.draw(cg, in: CGRect(x: -CGFloat(x) * scale, y: -(CGFloat(cg.height) - CGFloat(y) * scale - 1), width: CGFloat(cg.width), height: CGFloat(cg.height)))
        return Array(bytes.prefix(3))
    }
}
