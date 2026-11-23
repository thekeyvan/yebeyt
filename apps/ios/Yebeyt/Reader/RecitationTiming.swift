import Foundation

/// Ganjoor's timing file for a recitation (`xmlUrl`): when each verse (hemistich, numbered from 0) starts.
/// Two verses make a couplet; a single-line couplet is one verse.
struct RecitationTiming: Equatable, Sendable {
    struct Start: Equatable, Sendable {
        var verse: Int
        var milliseconds: Int
    }

    enum ParseError: Error { case noTimings }

    /// In time order.
    let starts: [Start]

    init(starts: [Start]) {
        self.starts = starts.sorted { $0.milliseconds < $1.milliseconds }
    }

    init(xml: Data) throws {
        let reader = SyncReader()
        let parser = XMLParser(data: xml)
        parser.delegate = reader
        guard parser.parse(), !reader.starts.isEmpty else { throw ParseError.noTimings }
        self.init(starts: reader.starts)
    }

    /// The couplet being read `seconds` into the audio. Before the first entry it is the first couplet;
    /// a verse past the text sticks to the last couplet. Nil only when there are no couplets.
    func couplet(at seconds: Double, in couplets: [Couplet]) -> Int? {
        guard !couplets.isEmpty else { return nil }
        let milliseconds = seconds * 1000
        let verse = starts.last { Double($0.milliseconds) <= milliseconds }?.verse ?? 0
        var first = 0
        for (index, couplet) in couplets.enumerated() {
            first += couplet.m2.isEmpty ? 1 : 2
            if verse < first { return index }
        }
        return couplets.count - 1
    }
}

/// Reads the `SyncInfo` entries of the first `PoemAudio` in the file.
private final class SyncReader: NSObject, XMLParserDelegate {
    private(set) var starts: [RecitationTiming.Start] = []
    private var element = ""
    private var text = ""
    private var verse: Int?
    private var milliseconds: Int?
    private var finished = false

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        element = name
        text = ""
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        text += string
    }

    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
        let value = Int(text.trimmingCharacters(in: .whitespacesAndNewlines))
        switch name {
        case "VerseOrder": verse = value
        case "AudioMiliseconds": milliseconds = value
        case "SyncInfo":
            // Real files end with a marker entry whose VerseOrder is negative (-2); it starts no verse.
            if let verse, verse >= 0, let milliseconds, !finished { starts.append(.init(verse: verse, milliseconds: milliseconds)) }
            verse = nil
            milliseconds = nil
        case "PoemAudio":
            finished = true
        default: break
        }
    }
}
