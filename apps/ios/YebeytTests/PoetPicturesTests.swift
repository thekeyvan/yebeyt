import Foundation
import Testing
import UIKit
@testable import Yebeyt

@MainActor
struct PoetPicturesTests {
    private struct Clock: @unchecked Sendable {
        final class Box: @unchecked Sendable { var now = Date(timeIntervalSince1970: 1_800_000_000) }
        let box = Box()
        func advance(seconds: Double) { box.now = box.now.addingTimeInterval(seconds) }
    }

    private func png(_ color: UIColor) -> Data {
        UIGraphicsImageRenderer(size: CGSize(width: 8, height: 8)).pngData { context in
            color.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 8, height: 8))
        }
    }

    private func directory() -> URL {
        URL.temporaryDirectory.appending(path: "poet-pictures-\(UUID().uuidString)", directoryHint: .isDirectory)
    }

    /// What the server lists now (slug → version); a test can change it while the app runs.
    private final class Listed: @unchecked Sendable {
        var versions: [String: String]
        init(_ versions: [String: String]) { self.versions = versions }
    }

    /// A server with a list of `versions` (slug → version) and a picture per slug; a new version has a new picture.
    private func server(_ listed: Listed, offline: Bool = false) -> StubServer {
        let red = png(.red), green = png(.green)
        return StubServer { request in
            if offline { return .offline }
            if request.path == "/v1/poets/pictures" {
                let entries = listed.versions.sorted { $0.key < $1.key }.map { #"{"slug":"\#($0.key)","version":"\#($0.value)","url":"/v1/poets/\#($0.key)/picture?v=\#($0.value)"}"# }
                return .json(200, "[\(entries.joined(separator: ","))]")
            }
            return request.path.hasSuffix("/picture") ? .data(request.query == "v=bbb" ? green : red) : .json(404, "{}")
        }
    }

    private func server(_ versions: [String: String], offline: Bool = false) -> StubServer {
        server(Listed(versions), offline: offline)
    }

    private func pictures(_ stub: StubServer, in folder: URL, clock: Clock = Clock()) -> PoetPictures {
        PoetPictures(api: stub.api, directory: folder, now: { clock.box.now })
    }

    @Test func theListIsNotAskedForAgainWithinAMinute() async {
        let stub = server(["hafez": "aaa"])
        let clock = Clock()
        let pictures = pictures(stub, in: directory(), clock: clock)
        await pictures.refreshList()
        clock.advance(seconds: 30)
        await pictures.refreshList()
        clock.advance(seconds: 29)
        await pictures.refreshList()
        #expect(stub.requests(to: "/v1/poets/pictures").count == 1)
        clock.advance(seconds: 2)
        await pictures.refreshList()
        #expect(stub.requests(to: "/v1/poets/pictures").count == 2)
        #expect(pictures.versions == ["hafez": "aaa"])
    }

    @Test func comingBackAfterAMinuteAsksAgainAndANewVersionReplacesThePicture() async {
        let folder = directory()
        let clock = Clock()
        let listed = Listed(["hafez": "aaa"])
        let stub = server(listed)
        let pictures = pictures(stub, in: folder, clock: clock)
        await pictures.refreshList()
        await pictures.load(slug: "hafez")
        let old = pictures.images["hafez"]?.pngData()
        #expect(old != nil)

        listed.versions = ["hafez": "bbb"]  // uploaded while the app was in the background
        clock.advance(seconds: 61)
        await pictures.refreshList()
        #expect(stub.requests(to: "/v1/poets/pictures").count == 2)
        #expect(pictures.versions == ["hafez": "bbb"])
        await pictures.load(slug: "hafez")  // what a circle on screen does when the version changes
        #expect(pictures.images["hafez"]?.pngData() != old)
        #expect(!FileManager.default.fileExists(atPath: folder.appending(path: "hafez-aaa.img").path))
        #expect(FileManager.default.fileExists(atPath: folder.appending(path: "hafez-bbb.img").path))
    }

    @Test func aFreshLaunchAsksAgainAndTheSavedListShowsUntilTheAnswerComes() async {
        let folder = directory()
        await pictures(server(["hafez": "aaa"]), in: folder).refreshList()
        let second = server(["hafez": "bbb"])
        let relaunched = pictures(second, in: folder)
        #expect(relaunched.versions == ["hafez": "aaa"])
        await relaunched.refreshList()
        #expect(second.requests(to: "/v1/poets/pictures").count == 1)
        #expect(relaunched.versions == ["hafez": "bbb"])
    }

    @Test func aFailedAskKeepsTheSavedList() async {
        let folder = directory()
        await pictures(server(["hafez": "aaa"]), in: folder).refreshList()
        let offline = pictures(server(["hafez": "bbb"], offline: true), in: folder)
        await offline.refreshList()
        #expect(offline.versions == ["hafez": "aaa"])
    }

    @Test func aPictureIsDownloadedWhenFirstShownAndKeptOnTheDisk() async {
        let folder = directory()
        let stub = server(["hafez": "aaa", "saadi": "bbb"])
        let pictures = pictures(stub, in: folder)
        await pictures.refreshList()
        #expect(pictures.images.isEmpty)  // nothing is downloaded before a circle asks
        await pictures.load(slug: "hafez")
        await pictures.load(slug: "hafez")
        #expect(pictures.images["hafez"] != nil)
        #expect(pictures.images["saadi"] == nil)
        let downloads = stub.requests(to: "/v1/poets/hafez/picture")
        #expect(downloads.count == 1)
        #expect(downloads.first?.query == "v=aaa")
        #expect(FileManager.default.fileExists(atPath: folder.appending(path: "hafez-aaa.img").path))
    }

    @Test func concurrentCirclesShareOneDownload() async {
        let stub = server(["hafez": "aaa"])
        stub.delay = 0.1
        let pictures = pictures(stub, in: directory())
        await pictures.refreshList()
        let loads = (0..<5).map { _ in Task { await pictures.load(slug: "hafez") } }
        for load in loads { await load.value }
        #expect(stub.requests(to: "/v1/poets/hafez/picture").count == 1)
    }

    @Test func aNewVersionIsFetchedAndTheOldFileRemoved() async {
        let folder = directory()
        let old = server(["hafez": "aaa"])
        let before = pictures(old, in: folder)
        await before.refreshList()
        await before.load(slug: "hafez")

        let new = server(["hafez": "bbb"])
        let after = pictures(new, in: folder)
        await after.refreshList()
        #expect(after.versions == ["hafez": "bbb"])
        await after.load(slug: "hafez")
        #expect(new.requests(to: "/v1/poets/hafez/picture").first?.query == "v=bbb")
        #expect(after.images["hafez"] != nil)
        #expect(!FileManager.default.fileExists(atPath: folder.appending(path: "hafez-aaa.img").path))
        #expect(FileManager.default.fileExists(atPath: folder.appending(path: "hafez-bbb.img").path))
    }

    @Test func withNoNetworkTheSavedPictureShowsAndPoetsWithoutOneKeepTheDefault() async {
        let folder = directory()
        let online = server(["hafez": "aaa"])
        let first = pictures(online, in: folder)
        await first.refreshList()
        await first.load(slug: "hafez")

        let offline = server(["hafez": "aaa"], offline: true)
        let second = pictures(offline, in: folder)
        await second.refreshList()
        await second.load(slug: "hafez")
        await second.load(slug: "saadi")
        #expect(second.images["hafez"] != nil)  // from the disk
        #expect(second.images["saadi"] == nil)  // the default circle
        #expect(offline.requests(to: "/v1/poets/hafez/picture").isEmpty)
    }

    @Test func aPhoneThatHasNeverBeenOnlineJustShowsDefaults() async {
        let stub = server(["hafez": "aaa"], offline: true)
        let pictures = pictures(stub, in: directory())
        await pictures.refreshList()
        await pictures.load(slug: "hafez")
        #expect(pictures.images.isEmpty && pictures.versions.isEmpty)
    }

    @Test func aFailedDownloadOrAnAnswerThatIsNoPictureIsNotKept() async {
        let folder = directory()
        let stub = StubServer { request in
            request.path == "/v1/poets/pictures" ? .json(200, #"[{"slug":"hafez","version":"aaa","url":"/v1/poets/hafez/picture?v=aaa"}]"#) : .data(Data("not an image".utf8))
        }
        let pictures = pictures(stub, in: folder)
        await pictures.refreshList()
        await pictures.load(slug: "hafez")
        #expect(pictures.images["hafez"] == nil)
        #expect(!FileManager.default.fileExists(atPath: folder.appending(path: "hafez-aaa.img").path))
    }

    @Test func entriesThatCouldEscapeTheCacheFolderOrLeaveOurServerAreDropped() async {
        let stub = StubServer { _ in
            .json(200, #"[{"slug":"../evil","version":"a","url":"/x"},{"slug":"ok","version":"a/b","url":"/x"},{"slug":"far","version":"a","url":"https://evil.test/p"},{"slug":"good","version":"a1","url":"/v1/poets/good/picture?v=a1"}]"#)
        }
        let pictures = pictures(stub, in: directory())
        await pictures.refreshList()
        #expect(pictures.versions == ["good": "a1"])
    }
}
