import Foundation
import Testing
@testable import Yebeyt

struct InviteTests {
    @Test func theThreeTonesHaveTheirTexts() {
        #expect(InviteTone.allCases.map(\.title) == ["رفیقانه", "شاعرانه", "کوتاه"])
        #expect(InviteTone.friendly.body == "یه اپ پیدا کردم که شعر فارسی رو بازی می‌کنه! هر روز یه بیت، جورچین، مشاعره با رفیقا. بیا با هم مشاعره کنیم، من شروع می‌کنم:")
        #expect(InviteTone.poetic.body == "شعر فارسی رو با یه بیت دوباره پیدا کردم؛ هر روز یه بیت، یه بازی. بیا با هم مشاعره کنیم، من شروع می‌کنم:")
        #expect(InviteTone.short.body == "بیا با هم مشاعره کنیم:")
    }

    @Test func theMessageIsTheBodyTheOpenerCoupletAndTheLink() {
        let text = InviteMessage.text(body: InviteTone.short.body, username: "niloofar")
        #expect(text == "بیا با هم مشاعره کنیم:\n«الا یا ایها الساقی ادر کأسا و ناولها»\nyebeyt.com/i/niloofar")
        #expect(InviteMessage.opener == "الا یا ایها الساقی ادر کأسا و ناولها")
    }

    @Test func aTextWrittenByTheUserIsUsedAsIs() {
        let text = InviteMessage.text(body: "سلام، بیا!", username: "ali.r")
        #expect(text.hasPrefix("سلام، بیا!\n"))
        #expect(text.hasSuffix("yebeyt.com/i/ali.r"))
    }

    @Test func theLinkIsThePersonalOne() {
        #expect(InviteLink.display(username: "niloofar") == "yebeyt.com/i/niloofar")
        #expect(InviteLink.url(username: "niloofar") == "https://yebeyt.com/i/niloofar")
    }

    // MARK: Channels

    private let text = "بیا با هم مشاعره کنیم: a&b=c?d#e+f\nyebeyt.com/i/niloofar"

    private func decodedQuery(_ url: URL, name: String) -> String? {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == name }?.value
    }

    @Test func telegramGetsTheTextInTheQuery() throws {
        let url = try #require(InviteChannel.telegram.url(for: text))
        #expect(url.scheme == "tg" && url.host == "msg")
        #expect(decodedQuery(url, name: "text") == text)
    }

    @Test func whatsAppGetsTheTextInTheQuery() throws {
        let url = try #require(InviteChannel.whatsApp.url(for: text))
        #expect(url.scheme == "whatsapp" && url.host == "send")
        #expect(decodedQuery(url, name: "text") == text)
    }

    @Test func smsGetsTheTextAsTheBody() throws {
        let url = try #require(InviteChannel.sms.url(for: text))
        #expect(url.scheme == "sms")
        #expect(url.absoluteString.hasPrefix("sms:&body="))
        let encoded = String(url.absoluteString.dropFirst("sms:&body=".count))
        #expect(encoded.removingPercentEncoding == text)
    }

    @Test func theReservedCharactersAreEscapedSoTheTextCannotBreakTheQuery() throws {
        let url = try #require(InviteChannel.telegram.url(for: "a&b=c?d#e+f\ng"))
        let query = try #require(url.absoluteString.split(separator: "?", maxSplits: 1).last)
        #expect(!query.dropFirst("text=".count).contains(where: { "&=?#+\n ".contains($0) }))
        #expect(query.contains("%26") && query.contains("%3D") && query.contains("%3F") && query.contains("%23") && query.contains("%2B") && query.contains("%0A"))
    }

    @Test func theChannelsAreTheBoardsInOrderWithTheirSchemes() {
        #expect(InviteChannel.allCases.map(\.title) == ["پیامک", "تلگرام", "واتس‌اپ"])
        #expect(InviteChannel.telegram.scheme == "tg")
        #expect(InviteChannel.whatsApp.scheme == "whatsapp")
    }

    @Test func theAppDeclaresTheSchemesItAsksAbout() throws {
        let declared = try #require(Bundle(for: PoetryStore.self).object(forInfoDictionaryKey: "LSApplicationQueriesSchemes") as? [String])
        #expect(declared.contains("tg") && declared.contains("whatsapp"))
    }
}
