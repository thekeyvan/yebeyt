import type { Metadata } from "next";
import { DocPage } from "../../components/DocPage";

const description = "چه چیزی ذخیره می‌شه، کجا و چرا. What yebeyt stores, where and why.";

export const metadata: Metadata = {
  title: "حریم خصوصی",
  description,
  openGraph: { title: "حریم خصوصی · یه بیت", description, url: "/privacy" },
};

/** An HTML comment in the page's source (a JSX comment would not reach the HTML). */
const DraftNote = () => <div hidden dangerouslySetInnerHTML={{ __html: "<!-- draft for the owner's review -->" }} />;

export default function Privacy() {
  return (
    <>
      <DraftNote />
      <DocPage fa={<Persian />} en={<English />} />
    </>
  );
}

function Persian() {
  return (
    <>
      <h1>حریم خصوصی</h1>
      <p className="muted">آخرین به‌روزرسانی: ۳ آذر ۱۴۰۵</p>
      <p>یه بیت برای خوندن شعر و بازی با بیت‌هاست، نه جمع کردن اطلاعات. این صفحه می‌گه چه چیزی ذخیره می‌شه، کجا و چرا.</p>

      <h2>بدون حساب</h2>
      <p>
        اپ بدون حساب کاملاً کار می‌کنه. در این حالت هر چی نگه می‌داری (دیوان، جایی که خوندی، امتیاز و روزهای پشت‌سرهم، تنظیمات) فقط روی گوشیِ خودت می‌مونه و به سرور ما فرستاده نمی‌شه. فقط سه چیز ممکنه از گوشی به ما برسه: عکس شاعرها، بازخوردی که خودت بفرستی، و اگه چالشی رو از روی لینک بازی کنی، نتیجه‌ات با اسمی که خودت می‌نویسی.
      </p>

      <h2>با حساب (ورود با اپل یا گوگل)</h2>
      <p>حساب فقط وقتی لازمه که چیزی سرور بخواد: امتیاز و لیگ، دوست‌ها، پیام‌ها، همگام‌سازی دیوان. اگه وارد بشی، این‌ها روی سرور ما ذخیره می‌شه:</p>
      <ul>
        <li>شناسه‌ای که اپل یا گوگل برای حسابت به ما می‌ده. ایمیلت رو ذخیره نمی‌کنیم و اسمت رو هم از اپل یا گوگل نمی‌خونیم. برای ورود با اپل، یه توکن رمزشده هم نگه می‌داریم که موقع پاک کردن حساب بتونیم ورودت با اپل رو باطل کنیم.</li>
        <li>نام کاربری، اسمی که برای نمایش انتخاب کردی (اختیاریه) و چهره‌ای که ساختی.</li>
        <li>نشانه‌های ورود (فقط یه رمزِ یک‌طرفه‌شده‌ی اون‌ها)، که هر چند وقت یه بار عوض می‌شن.</li>
      </ul>

      <h2>چیزهایی که با حساب ذخیره می‌شه</h2>
      <ul>
        <li><b>دیوان:</b> کدوم بیت‌ها رو نگه داشتی و کی، تا روی همه‌ی گوشی‌هات باشه.</li>
        <li><b>امتیاز و لیگ:</b> امتیازها، بهترین نتیجه‌ی هر بازی، روزهای پشت‌سرهم، نتیجه‌ی معمای روز و جای تو در لیگ هفتگی. توی فهرست «همه» فقط وقتی هستی که خودت بخوای.</li>
        <li><b>دنبال‌کردن و دوست‌ها:</b> کسایی که دنبال می‌کنی و دنبالت می‌کنن (دو نفری که همدیگه رو دنبال کنن دوست‌اند)، و کسایی که بلاک کردی.</li>
        <li><b>پسند و بازنشر:</b> بیت‌هایی که پسندیدی یا بازنشر کردی؛ دوستات اون‌ها رو می‌بینن، مگه اینکه توی تنظیمات حریم خصوصی نخوای.</li>
        <li><b>پیام‌ها و دیوان مشترک:</b> متن پیام‌ها، بیت‌هایی که فرستادی (با یادداشتی که کنارش نوشتی)، دعوت بازی‌ها و بیت‌های دیوان مشترک با یه دوست. این‌ها برای رسوندن به طرف مقابل روی سرور ذخیره می‌شن، و با پاک شدن حسابت پاک می‌شن. می‌تونی پیام خودت رو هم جداگونه پاک کنی.</li>
        <li><b>بازی با دوستان و چالش‌ها:</b> مشاعره و بازی رودررو با حرکت‌هاشون، و چالش‌هایی که می‌سازی با نتیجه‌ی کسایی که بازی کردن. چالش بعد از ۳۰ روز با نتیجه‌هاش پاک می‌شه.</li>
        <li><b>تنظیمات حریم خصوصی:</b> اینکه کی بیت‌هات و نتیجه‌ی معماها رو ببینه، آنلاین بودنت، کی بتونه پیام بده یا به بازی دعوت کنه.</li>
      </ul>
      <p>از این اطلاعات فقط برای کارکرد اپ استفاده می‌کنیم. چیزی فروخته نمی‌شه.</p>

      <h2>گزارش آدم‌ها و پیام‌ها</h2>
      <p>
        هر کسی رو می‌تونی بلاک یا گزارش کنی. اگه پیامی رو گزارش کنی، یه نسخه از اون پیام (نوعش، متنش، بیت و یادداشتش) همراه گزارش نگه می‌داریم تا بتونیم بررسیش کنیم؛ حتی اگه فرستنده بعداً پیامش یا حسابش رو پاک کنه. گزارش بعد از پاک شدن حساب شاکی یا گزارش‌شده هم می‌مونه، اما دیگه به اون حساب وصل نیست. موقع گزارش، آی‌پی یا چیزی از اتصالت ثبت نمی‌شه.
      </p>

      <h2>بازخورد و گزارش مشکل</h2>
      <p>
        اگه بازخورد بفرستی، متن، عکس صفحه و (اگه بخوای) فیلم صفحه‌ات رو می‌گیریم. اگه باگ گزارش کنی، اطلاعات فنی گوشی (نسخه‌ی اپ، مدل و نسخه‌ی سیستم، صفحه‌ای که بودی، چند صفحه‌ی قبلش، کدهای خطاهای اخیر) هم همراهشه. اگه وارد حساب شده باشی، گزارش به نام کاربریت ثبت می‌شه؛ اگه نه، بی‌نام. چیزی که جای دیگه تایپ کردی، پیام‌هات، شماره‌ات، آی‌پی یا مکانت هیچ‌وقت همراهش نمی‌ره.
      </p>
      <p>بازخورد رو فقط خودمون می‌خونیم. اگه بعداً حسابت رو پاک کنی، متن بازخورد می‌مونه ولی بی‌نام.</p>

      <h2>چیزی که با سرویس‌های دیگه رد و بدل می‌شه</h2>
      <ul>
        <li><b>گنجور</b> (ganjoor.net و داده‌ی عمومی‌ش روی jsDelivr): متن شعرهایی که داخل اپ نیستن و فایل صوتی خوانش‌ها از اونجا میاد. این درخواست‌ها هیچ اطلاعاتی از حسابت ندارن.</li>
        <li><b>عکس شاعرها</b> از سرور خودمون میاد و هیچ اطلاعاتی از حسابت همراهش نیست.</li>
        <li><b>اپل و گوگل</b>: فقط وقتی خودت ورود با اون‌ها رو بزنی.</li>
      </ul>

      <h2>تبلیغ و ردیابی</h2>
      <p>تبلیغی در کار نیست و هیچ ابزار ردیابی یا تحلیل رفتاری نداریم، نه توی اپ و نه توی این سایت. این سایت کوکی هم نمی‌ذاره.</p>

      <h2>آی‌پی و لاگ‌ها</h2>
      <p>سرور ما از هر درخواست فقط روش، آدرسِ بخش، وضعیت و زمانش رو ثبت می‌کنه؛ نه آی‌پی، نه نام کاربری، نه چیزی از محتوا. آی‌پی هیچ‌جا کنار گزارش و بازخورد ذخیره نمی‌شه.</p>

      <h2>لینک‌ها و کلیپ‌بورد</h2>
      <p>
        وقتی از صفحه‌ی یه لینک (چالش، دعوت یا بازی) دکمه‌ی نصب اپ رو بزنی، آدرس اون لینک روی گوشیِ خودت کپی می‌شه. اپ بار اول که باز بشه، نگاه می‌کنه توی کلیپ‌بوردت لینک yebeyt.com هست یا نه، و اگه بود، پیشنهاد می‌ده همون چالش یا دعوت رو باز کنه. این بررسی روی گوشی انجام می‌شه و چیزی از کلیپ‌بوردت به ما نمی‌رسه، جز خودِ باز کردن همون لینک.
      </p>

      <h2>جای نگه‌داری</h2>
      <p>سرور و پایگاه داده‌ی یه بیت و همین سایت روی Railway میزبانی می‌شن، توی مرکز داده‌ای در اروپا.</p>

      <h2>پاک کردن حساب</h2>
      <p>
        از اپ: من ← تنظیمات ← پاک کردن حساب. این کار ورودت با اپل رو باطل می‌کنه و اینا رو از سرور پاک می‌کنه: حسابت، دیوان، امتیازها و لیگ، دنبال‌کردن‌ها، پسندها و بازنشرها، بلاک‌ها، چالش‌هات و نتیجه‌هات روی چالش‌های دیگران، دیوان‌های مشترک، و همه‌ی چت‌هایی که توشون بودی با همه‌ی پیام‌هاشون (طرف مقابل هم اون چت رو از دست می‌ده). بازی‌ای که منتظر نفر دوم بود پاک می‌شه و بازی در جریان با برد حریفت تموم می‌شه. چیزهایی که می‌مونن: گزارش‌هایی که دادی یا درباره‌ات دادن، و بازخوردهات؛ بدون اتصال به حسابت.
      </p>
      <p>
        اگه نمی‌تونی از اپ پاک کنی، به <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a> ایمیل بزن و نام کاربریت رو بنویس.
      </p>

      <h2>بچه‌ها</h2>
      <p>یه بیت برای همه‌ی سنین قابل استفاده‌ست، ولی ما آگاهانه از بچه‌های زیر ۱۳ سال اطلاعاتی جمع نمی‌کنیم. ساختن حساب اختیاریه.</p>

      <h2>تغییرات</h2>
      <p>اگه این متن عوض بشه، تاریخ بالای صفحه به‌روز می‌شه.</p>

      <h2>تماس</h2>
      <p><a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a></p>
    </>
  );
}

function English() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 24 November 2026</p>
      <p>yebeyt is for reading poetry and playing with couplets, not for collecting data. This page explains what we store, where and why.</p>

      <h2>Without an account</h2>
      <p>
        The app works fully without an account. Everything you keep (your divan, where you stopped reading, points and streak, settings) stays on your phone and is never sent to our server. Only three things can reach us from your phone: the poets' pictures (a download), feedback you choose to send, and, if you play a challenge from a link, your result with the name you type.
      </p>

      <h2>With an account (Sign in with Apple or Google)</h2>
      <p>An account is needed only for what has a server behind it: points and leagues, friends, messages, syncing your divan. If you sign in, we store this on our server:</p>
      <ul>
        <li>The identifier Apple or Google gives us for your account. We do not store your email address, and we do not read your name from Apple or Google. For Sign in with Apple we also keep an encrypted token so we can revoke the sign-in when you delete your account.</li>
        <li>Your username, the display name you chose (optional) and the face you built.</li>
        <li>Sign-in tokens (only a one-way hash of them), which are replaced regularly.</li>
      </ul>

      <h2>What is stored with an account</h2>
      <ul>
        <li><b>Divan:</b> which couplets you kept and when, so they are on all your devices.</li>
        <li><b>Points and leagues:</b> points, your best result in each game, your streak of days, the result of the daily puzzle and your place in the weekly league. You are on the «everyone» list only if you allow it.</li>
        <li><b>Follows and friends:</b> who you follow and who follows you (two people who follow each other are friends), and who you blocked.</li>
        <li><b>Likes and reposts:</b> couplets you liked or reposted; your friends see them unless you turn that off in the privacy settings.</li>
        <li><b>Messages and shared divans:</b> the text of messages, couplets you sent (with the note you wrote), game invitations, and the couplets of a shared divan with a friend. They are stored on the server so they can be delivered, and they are deleted with your account. You can also delete a message of yours on its own.</li>
        <li><b>Games with friends and challenges:</b> مشاعره and the live duel with their moves, and the challenges you make with the results of the people who played them. A challenge and its results are deleted after 30 days.</li>
        <li><b>Privacy settings:</b> who sees your kept couplets and daily result, whether you show as online, who may message you or invite you to a game.</li>
      </ul>
      <p>We use this only to make the app work. Nothing is sold.</p>

      <h2>Reporting people and messages</h2>
      <p>
        You can block or report anyone. If you report a message, we keep a copy of that message (its kind, text, couplet and note) with the report so we can review it, even if the sender later deletes the message or their account. A report stays after the account of the reporter or the reported person is deleted, but it is no longer linked to that account. Nothing about your connection, such as your IP address, is stored with a report.
      </p>

      <h2>Feedback and bug reports</h2>
      <p>
        If you send feedback, we receive its text, a screenshot and, if you choose, a screen recording. If you report a bug, technical information about the phone comes with it (app version, phone model and system version, the screen you were on, a few screens before it, and recent error codes). If you are signed in, the report is filed under your username; if not, it is anonymous. Text you typed elsewhere, your messages, your phone number, your IP address or your location are never sent with it.
      </p>
      <p>Only we read feedback. If you later delete your account, the text of your feedback stays, but anonymous.</p>

      <h2>What passes through other services</h2>
      <ul>
        <li><b>Ganjoor</b> (ganjoor.net and its public data on jsDelivr): the text of poems that are not bundled, and the recitation audio. These requests carry no account information.</li>
        <li><b>Poets' pictures</b> come from our own server and carry no account information.</li>
        <li><b>Apple and Google:</b> only when you choose to sign in with them.</li>
      </ul>

      <h2>Ads and tracking</h2>
      <p>There are no ads and we use no tracking or analytics tools, neither in the app nor on this website. This website sets no cookies.</p>

      <h2>IP addresses and logs</h2>
      <p>For every request our server logs only the method, the route, the status and the time; no IP address, no username, no content. An IP address is never stored with a report or with feedback.</p>

      <h2>Links and the clipboard</h2>
      <p>
        When you press the install button on the page of a link (a challenge, an invite or a game), the address of that link is copied to the clipboard of your own phone. The first time the app opens, it checks whether your clipboard holds a yebeyt.com link and, if so, offers to open that challenge or invite. This check happens on your phone; nothing from your clipboard reaches us, except opening that same link.
      </p>

      <h2>Where it is kept</h2>
      <p>The yebeyt server and database, and this website, are hosted on Railway, in a data centre in Europe.</p>

      <h2>Deleting your account</h2>
      <p>
        In the app: Me → Settings → Delete account. This revokes your Sign in with Apple and deletes from our server: your account, divan, points and league places, follows, likes and reposts, blocks, your challenges and your results on other people's challenges, shared divans, and every chat you were in with all its messages (the other person loses that chat too). A game waiting for a second player is deleted, and a game in progress ends with your opponent as the winner. What stays: reports you filed or that name you, and your feedback; neither is linked to your account any more.
      </p>
      <p>
        If you cannot delete it from the app, email <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a> with your username.
      </p>

      <h2>Children</h2>
      <p>yebeyt is suitable for all ages, but we do not knowingly collect personal data from children under 13. Creating an account is optional.</p>

      <h2>Changes</h2>
      <p>If this text changes, the date at the top of the page is updated.</p>

      <h2>Contact</h2>
      <p><a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a></p>
    </>
  );
}
