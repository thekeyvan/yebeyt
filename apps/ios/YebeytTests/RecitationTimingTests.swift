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

    @Test func aFileWithoutTimingsIsRejected() {
        #expect(throws: RecitationTiming.ParseError.self) { try RecitationTiming(xml: Data("<A/>".utf8)) }
        #expect(throws: RecitationTiming.ParseError.self) { try RecitationTiming(xml: Data("not xml".utf8)) }
    }
}
