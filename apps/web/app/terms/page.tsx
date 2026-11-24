import type { Metadata } from "next";
import { DocPage } from "../../components/DocPage";

const description = "شرایط استفاده از یه بیت. Terms of use for yebeyt.";

export const metadata: Metadata = {
  title: "شرایط استفاده",
  description,
  openGraph: { title: "شرایط استفاده · یه بیت", description, url: "/terms" },
};

export default function Terms() {
  return <DocPage fa={<Persian />} en={<English />} />;
}

function Persian() {
  return (
    <>
      <h1>شرایط استفاده</h1>
      <p className="muted">آخرین به‌روزرسانی: ۳ آذر ۱۴۰۵</p>
      <p>یه بیت رایگانه و برای لذت بردن از شعر فارسی ساخته شده. با استفاده از اپ این‌ها رو می‌پذیری:</p>
      <ul>
        <li><b>محتوا:</b> شعرها از کتابخانه‌ی آزاد گنجور میان. معنی‌ها (به‌خصوص اون‌هایی که ستاره‌ی کوچیک دارن) با کمک هوش مصنوعی نوشته شدن و ممکنه اشتباه داشته باشن؛ برای کار علمی به منابع معتبر مراجعه کن.</li>
        <li><b>حساب:</b> ساختن حساب اختیاریه. مسئول امنیت حساب اپل یا گوگلِ خودت هستی. هر وقت بخوای می‌تونی حسابت رو از داخل اپ پاک کنی.</li>
        <li><b>چیزی که خودت می‌نویسی:</b> پیام‌ها، یادداشتِ کنار بیت‌ها، اسم نمایشی و نام کاربری مال خودتن و مسئولشون هم خودتی. توهین، آزار، تهدید، تبلیغ و پیام‌های تکراری و مزاحم ممنوعه. از اسم یا عکس یا نام کاربری دیگران هم نمی‌تونی استفاده کنی.</li>
        <li><b>گزارش و برخورد:</b> هر کسی می‌تونه آدم یا پیامی رو بلاک یا گزارش کنه. گزارش‌ها رو بررسی می‌کنیم و می‌تونیم محتوایی رو پاک کنیم، یه حساب رو محدود یا مسدود کنیم، یا نام کاربری‌ای رو پس بگیریم؛ بیشتر وقت‌ها بدون هشدار قبلی، اگه لازم باشه.</li>
        <li><b>استفاده‌ی درست:</b> از اپ و سرورش برای آسیب زدن، سوءاستفاده، تقلب در امتیازها یا دسترسی غیرمجاز استفاده نکن.</li>
        <li><b>بدون ضمانت:</b> اپ «همین‌طور که هست» ارائه می‌شه. تلاش می‌کنیم همیشه کار کنه، ولی ممکنه گاهی در دسترس نباشه.</li>
        <li><b>کد باز:</b> کدِ اپ با مجوز MIT روی <a href="https://github.com/thekeyvan/yebeyt">گیت‌هاب</a> منتشر شده.</li>
        <li><b>تغییرات:</b> اگه این شرایط عوض بشه، تاریخ بالای همین صفحه به‌روز می‌شه.</li>
      </ul>
      <p>اینکه با اطلاعاتت چی کار می‌کنیم توی <a href="/privacy">حریم خصوصی</a> نوشته شده. سؤال داری؟ <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a></p>
    </>
  );
}

function English() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="muted">Last updated: 24 November 2026</p>
      <p>yebeyt is free and made for enjoying Persian poetry. By using the app you agree to the following:</p>
      <ul>
        <li><b>Content:</b> poems come from Ganjoor&apos;s open library. Meanings (especially those marked with a small sparkle) were written with AI help and may contain mistakes; use authoritative sources for scholarly work.</li>
        <li><b>Accounts:</b> an account is optional. You are responsible for the security of your Apple or Google account. You can delete your yebeyt account from inside the app at any time.</li>
        <li><b>What you write:</b> messages, notes beside couplets, your display name and username are yours, and you are responsible for them. Abuse, harassment, threats, advertising, and repeated or unwanted messages are not allowed. You may not use another person&apos;s name, picture or username.</li>
        <li><b>Reports and enforcement:</b> anyone can block or report a person or a message. We review reports, and we may remove content, limit or block an account, or take back a username, in most cases without warning if needed.</li>
        <li><b>Acceptable use:</b> don&apos;t use the app or its server to cause harm, abuse it, cheat in the scores, or gain unauthorized access.</li>
        <li><b>No warranty:</b> the app is provided &ldquo;as is&rdquo;. We try to keep it running but it may sometimes be unavailable.</li>
        <li><b>Open source:</b> the app&apos;s code is published under the MIT license on <a href="https://github.com/thekeyvan/yebeyt">GitHub</a>.</li>
        <li><b>Changes:</b> if these terms change, the date at the top of this page is updated.</li>
      </ul>
      <p>What we do with your data is in the <a href="/privacy">Privacy Policy</a>. Questions? <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a></p>
    </>
  );
}
