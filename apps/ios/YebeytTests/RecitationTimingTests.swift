import AVFoundation
import Foundation
import Testing
@testable import Yebeyt

struct RecitationTimingTests {
    private let ghazal = (0..<4).map { Couplet(m1: "الف\($0)", m2: "ب\($0)") }

    private func timing() throws -> RecitationTiming {
        try RecitationTiming(xml: Fixtures.data("timing-2130-ff", extension: "xml"))
    }

    @Test func parsesTheStartOfEveryVerse() throws {
        let timing = try timing()
        #expect(timing.starts.map(\.verse) == [0, 1, 2, 3, 4, 5])
        #expect(timing.starts.map(\.milliseconds) == [0, 7386, 15486, 21036, 29886, 34986])
    }

    @Test func twoVersesMakeOneCouplet() throws {
        let timing = try timing()
        #expect(timing.couplet(at: 0, in: ghazal) == 0)
        #expect(timing.couplet(at: 7.385, in: ghazal) == 0)  // still the first hemistich
        #expect(timing.couplet(at: 7.386, in: ghazal) == 0)  // second hemistich of the first couplet
        #expect(timing.couplet(at: 15.5, in: ghazal) == 1)
        #expect(timing.couplet(at: 21.1, in: ghazal) == 1)
        #expect(timing.couplet(at: 30, in: ghazal) == 2)
    }

    @Test func afterTheLastVerseStaysOnItsCouplet() throws {
        #expect(try timing().couplet(at: 500, in: ghazal) == 2)
    }

    @Test func aVerseBeyondTheTextIsClampedToTheLastCouplet() throws {
        #expect(try timing().couplet(at: 40, in: [Couplet(m1: "الف", m2: "ب")]) == 0)
    }

    @Test func aSingleLineCoupletIsOneVerse() throws {
        let mixed = [Couplet(m1: "نثر", m2: ""), Couplet(m1: "الف", m2: "ب"), Couplet(m1: "پ", m2: "ت")]
        let timing = try timing()
        #expect(timing.couplet(at: 7.4, in: mixed) == 1)  // verse 1 is the first of couplet 1
        #expect(timing.couplet(at: 21.1, in: mixed) == 2)  // verse 3 starts couplet 2
    }

    @Test func timeBeforeTheFirstEntryIsTheFirstCouplet() {
        let timing = RecitationTiming(starts: [.init(verse: 0, milliseconds: 1500)])
        #expect(timing.couplet(at: 0.2, in: ghazal) == 0)
    }

    @Test func noCoupletsGivesNoAnswer() throws {
        #expect(try timing().couplet(at: 3, in: []) == nil)
    }

    @Test func entriesOutOfOrderAreSorted() throws {
        let xml = """
        <A><PoemAudio><SyncArray>
        <SyncInfo><VerseOrder>2</VerseOrder><AudioMiliseconds>9000</AudioMiliseconds></SyncInfo>
        <SyncInfo><VerseOrder>0</VerseOrder><AudioMiliseconds>0</AudioMiliseconds></SyncInfo>
        </SyncArray></PoemAudio></A>
        """
        let timing = try RecitationTiming(xml: Data(xml.utf8))
        #expect(timing.couplet(at: 10, in: ghazal) == 1)
    }

    @Test func negativeVerseOrdersAreSkipped() throws {
        let xml = """
        <A><PoemAudio><SyncArray>
        <SyncInfo><VerseOrder>0</VerseOrder><AudioMiliseconds>0</AudioMiliseconds></SyncInfo>
        <SyncInfo><VerseOrder>2</VerseOrder><AudioMiliseconds>9000</AudioMiliseconds></SyncInfo>
        <SyncInfo><VerseOrder>-2</VerseOrder><AudioMiliseconds>40000</AudioMiliseconds></SyncInfo>
        </SyncArray></PoemAudio></A>
        """
        let timing = try RecitationTiming(xml: Data(xml.utf8))
        #expect(timing.starts.map(\.verse) == [0, 2])
        // The end marker would otherwise read as verse -2 and send the text back to the first couplet.
        #expect(timing.couplet(at: 45, in: ghazal) == 1)
    }

    @Test func aCoupletStartsWhereItsFirstVerseDoes() throws {
        let timing = try timing()
        #expect(timing.start(ofCouplet: 0, in: ghazal) == 0)
        #expect(timing.start(ofCouplet: 1, in: ghazal) == 15.486)  // verse 2
        #expect(timing.start(ofCouplet: 2, in: ghazal) == 29.886)  // verse 4
    }

    @Test func theStartOfASingleLineCoupletCountsOneVerse() throws {
        let mixed = [Couplet(m1: "نثر", m2: ""), Couplet(m1: "الف", m2: "ب"), Couplet(m1: "پ", m2: "ت")]
        let timing = try timing()
        #expect(timing.start(ofCouplet: 0, in: mixed) == 0)
        #expect(timing.start(ofCouplet: 1, in: mixed) == 7.386)  // verse 1
        #expect(timing.start(ofCouplet: 2, in: mixed) == 21.036)  // verse 3
    }

    @Test func aCoupletPastTheEndOrWithoutATimingHasNoStart() throws {
        let timing = try timing()
        #expect(timing.start(ofCouplet: 3, in: ghazal) == nil)  // verse 6: the file ends at verse 5
        #expect(timing.start(ofCouplet: 4, in: ghazal) == nil)  // not in the text
        #expect(timing.start(ofCouplet: 9, in: ghazal) == nil)
        #expect(timing.start(ofCouplet: -1, in: ghazal) == nil)
        #expect(timing.start(ofCouplet: 0, in: []) == nil)
    }

    @Test func startAndCoupletAtAreInverse() throws {
        let timing = try timing()
        for index in 0..<3 {
            let start = try #require(timing.start(ofCouplet: index, in: ghazal))
            #expect(timing.couplet(at: start, in: ghazal) == index)
        }
    }

    /// Starts whose milliseconds don't divide evenly in binary (1.001 × 1000 is 1000.9999…) or in the 600 timescale
    /// (3.347 s is 3.34667 s) must still read as their own couplet at exactly their start.
    @Test func aPositionAtAStartIsThatCouplet() {
        let timing = RecitationTiming(starts: [
            .init(verse: 0, milliseconds: 0), .init(verse: 2, milliseconds: 1001), .init(verse: 4, milliseconds: 3347),
            .init(verse: 6, milliseconds: 5002),
        ])
        let couplets = (0..<4).map { Couplet(m1: "الف\($0)", m2: "ب\($0)") }
        for (index, milliseconds) in [0, 1001, 3347, 5002].enumerated() {
            let seconds = Double(milliseconds) / 1000
            #expect(timing.couplet(at: seconds, in: couplets) == index)
            #expect(timing.couplet(at: AVRecitationEngine.time(seconds).seconds, in: couplets) == index)
        }
    }

    @Test func theSeekTimeIsExactToTheMillisecond() {
        for milliseconds in [3347, 3344, 5002, 1001, 29886] {
            let time = AVRecitationEngine.time(Double(milliseconds) / 1000)
            #expect(time.timescale == 1000)
            #expect(time.value == Int64(milliseconds))
        }
    }

    @Test func aFileWithoutTimingsIsRejected() {
        #expect(throws: RecitationTiming.ParseError.self) { try RecitationTiming(xml: Data("<A/>".utf8)) }
        #expect(throws: RecitationTiming.ParseError.self) { try RecitationTiming(xml: Data("not xml".utf8)) }
    }
}
