import Foundation
import Testing
@testable import Yebeyt

struct MessageCopyTests {
    @Test func errorsBecomeTheLeadsLines() {
        func line(_ status: Int, _ code: APIErrorCode?, divan: Bool = false) -> String {
            MessageCopy.toast(for: .server(status: status, code: code, allowedAt: nil), sharedDivan: divan)
        }
        #expect(line(429, .rateLimited) == "یه کم آروم‌تر")
        #expect(line(429, nil) == "یه کم آروم‌تر")
        #expect(line(403, .messagesClosed) == "دیگه نمی‌تونی به این گفتگو پیام بدی")
        #expect(line(403, .forbidden, divan: true) == "فقط با دوستات می‌شه دیوان مشترک داشت")
        #expect(line(403, .forbidden) == APIError.server(status: 403, code: .forbidden, allowedAt: nil).persianMessage)
        #expect(MessageCopy.toast(for: .network) == APIError.network.persianMessage)
        #expect(line(500, .internalError) == APIError.badResponse.persianMessage)  // nothing technical reaches the screen
    }

    @Test func theLinesOfTheChatAreTheLeadsCopy() {
        #expect(MessageCopy.notSent == "نرسید · دوباره")
        #expect(MessageCopy.sending == "در حال فرستادن")
        #expect(MessageCopy.divanAdded(by: "سارا") == "سارا یه بیت به دیوان مشترک اضافه کرد")
        #expect(MessageCopy.gameInvite(from: "آرین", game: "duel") == "آرین دعوتت کرد به بازی رودررو")
        #expect(MessageCopy.gameInvite(from: "سارا", game: "mosh") == "سارا دعوتت کرد به مشاعره")
        #expect(MessageCopy.gameInvite(from: "سارا", game: nil) == "سارا دعوتت کرد به بازی")
    }

    @Test func reportReasonsAreTheThreeOfTheFriendsSlice() {
        #expect(ReportReason.allCases.map(\.title) == ["اسپم", "بی‌احترامی", "یه چیز دیگه"])
        #expect(ReportReason.allCases.map(\.rawValue) == ["spam", "abuse", "other"])
    }

    @Test func timesAreInPersianDigitsAndDaysAreLabelled() {
        let calendar = MessageClock.calendar
        let now = MessageClock.now
        #expect(ChatTime.clock(MessageClock.date("2026-11-24T09:45:00Z"), calendar: calendar) == "۹:۴۵")
        #expect(ChatTime.clock(MessageClock.date("2026-11-24T09:05:00Z"), calendar: calendar) == "۹:۰۵")
        #expect(ChatTime.clock(MessageClock.date("2026-11-24T00:00:00Z"), calendar: calendar) == "۰:۰۰")
        #expect(ChatTime.day(MessageClock.date("2026-11-24T00:01:00Z"), now: now, calendar: calendar) == "امروز")
        #expect(ChatTime.day(MessageClock.date("2026-11-23T23:59:00Z"), now: now, calendar: calendar) == "دیروز")
        #expect(ChatTime.day(MessageClock.date("2026-11-21T10:00:00Z"), now: now, calendar: calendar) == "شنبه")
        #expect(ChatTime.day(MessageClock.date("2026-11-18T10:00:00Z"), now: now, calendar: calendar) == "چهارشنبه")  // six days back
        #expect(ChatTime.day(MessageClock.date("2026-11-17T10:00:00Z"), now: now, calendar: calendar) == "۲۶ آبان")
        // The inbox shows the time for today and the day's label for the rest.
        #expect(ChatTime.stamp(MessageClock.date("2026-11-24T09:45:00Z"), now: now, calendar: calendar) == "۹:۴۵")
        #expect(ChatTime.stamp(MessageClock.date("2026-11-23T09:45:00Z"), now: now, calendar: calendar) == "دیروز")
    }

    @Test func leagueTiersAreNamedLikeTheLevels() {
        #expect(LeagueName.line(tier: 2) == "لیگ غزل‌باز")
        #expect(LeagueName.line(tier: 0) == "لیگ نوآموز")
        #expect(LeagueName.line(tier: 5) == nil)
    }

    @Test func coupletKeysAreParsed() {
        #expect(CoupletKey.parse("/hafez/ghazal/sh3#1")?.path == "/hafez/ghazal/sh3")
        #expect(CoupletKey.parse("/hafez/ghazal/sh3#1")?.index == 1)
        #expect(CoupletKey.parse("hafez#1") == nil)
        #expect(CoupletKey.parse("/hafez/ghazal/sh3") == nil)
        #expect(CoupletKey.parse("/hafez/ghazal/sh3#x") == nil)
    }
}
