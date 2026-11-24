import Foundation
import Observation
import UIKit

/// The real pictures of the poets. The phone has a default for each (`PoetCircle`); the server's pictures replace
/// it once loaded. The list (`GET /v1/poets/pictures`) is asked for on every launch and every time the app comes
/// back to the front (not twice within a minute) and kept on the disk, so a new picture shows at once. Each
/// picture is downloaded the first time it is shown and kept under a name with its version, so a new
/// version is fetched and the old file removed. With no network, what is on the disk shows.
@MainActor @Observable
final class PoetPictures {
    /// Two asks for the list are at least this many seconds apart: launch and coming to the front come together.
    static let minimumGap: TimeInterval = 60

    /// The pictures ready to draw, by poet slug.
    private(set) var images: [String: UIImage] = [:]
    /// The version of each poet's picture on the server, by slug. It changes when the list arrives or a picture is
    /// replaced; a circle on screen loads its picture again then.
    private(set) var versions: [String: String] = [:]
    @ObservationIgnored private var saved: [PoetPictureEntry] = []
    @ObservationIgnored private var lastAsked: Date?
    @ObservationIgnored private var shownVersions: [String: String] = [:]
    @ObservationIgnored private var downloads: [String: (version: String, task: Task<Void, Never>)] = [:]
    @ObservationIgnored private let api: API
    @ObservationIgnored private let directory: URL
    @ObservationIgnored private let now: () -> Date

    init(api: API, directory: URL = PoetPictures.defaultDirectory, now: @escaping () -> Date = { .now }) {
        self.api = api
        self.directory = directory
        self.now = now
        saved = (try? Data(contentsOf: listURL)).flatMap { try? JSONDecoder().decode([PoetPictureEntry].self, from: $0) } ?? []
        versions = Self.versions(saved)
    }

    nonisolated static var defaultDirectory: URL {
        URL.cachesDirectory.appending(path: "PoetPictures", directoryHint: .isDirectory)
    }

    private var listURL: URL { directory.appending(path: "list.json") }

    private func fileURL(_ entry: PoetPictureEntry) -> URL {
        directory.appending(path: "\(entry.slug)-\(entry.version).img")
    }

    /// Asks the server which poets have a picture, unless it was asked less than a minute ago.
    /// A failure keeps the list on the disk.
    func refreshList() async {
        if let lastAsked, now().timeIntervalSince(lastAsked) < Self.minimumGap { return }
        lastAsked = now()
        guard let entries = (try? await api.poetPictures())?.filter(\.isSafe) else { return }
        saved = entries
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(entries) { try? data.write(to: listURL, options: .atomic) }
        versions = Self.versions(entries)
    }

    private static func versions(_ entries: [PoetPictureEntry]) -> [String: String] {
        Dictionary(entries.map { ($0.slug, $0.version) }, uniquingKeysWith: { _, last in last })
    }

    /// Makes the picture of a poet ready: from the disk when its version is there, else downloaded. Nothing
    /// happens for a poet without a picture.
    func load(slug: String) async {
        guard let entry = saved.first(where: { $0.slug == slug }), shownVersions[slug] != entry.version else { return }
        if let running = downloads[slug] {
            await running.task.value
            // A download of an older version does not give this one: ask again once it is done.
            if running.version != entry.version { await load(slug: slug) }
            return
        }
        let task = Task { [self] in
            defer { downloads[slug] = nil }
            guard let image = await image(for: entry) else { return }
            images[slug] = image
            shownVersions[slug] = entry.version
        }
        downloads[slug] = (entry.version, task)
        await task.value
    }

    private func image(for entry: PoetPictureEntry) async -> UIImage? {
        let file = fileURL(entry)
        if let data = try? Data(contentsOf: file), let image = UIImage(data: data) { return image }
        guard let data = try? await api.pictureData(path: entry.url), let image = UIImage(data: data) else { return nil }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? data.write(to: file, options: .atomic)
        removeOtherVersions(of: entry)
        return image
    }

    private func removeOtherVersions(of entry: PoetPictureEntry) {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        for name in names where name.hasPrefix("\(entry.slug)-") && name.hasSuffix(".img") && name != fileURL(entry).lastPathComponent {
            try? FileManager.default.removeItem(at: directory.appending(path: name))
        }
    }
}

private extension PoetPictureEntry {
    /// Slug and version become part of a file name and the url is a path on our server: refuse anything else.
    var isSafe: Bool {
        func plain(_ text: String) -> Bool { !text.isEmpty && text.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") } }
        return plain(slug) && plain(version) && url.hasPrefix("/") && !url.hasPrefix("//")
    }
}
