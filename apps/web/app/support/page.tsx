import type { Metadata } from "next";
import { DocPage } from "../../components/DocPage";

const description = "سؤال، پیشنهاد یا مشکلی داری؟ Questions, ideas or a problem?";

export const metadata: Metadata = {
  title: "پشتیبانی",
  description,
  openGraph: { title: "پشتیبانی · یه بیت", description, url: "/support" },
};

export default function Support() {
  return <DocPage fa={<Persian />} en={<English />} />;
}

function Persian() {
  return (
    <>
      <h1>پشتیبانی</h1>
      <p>
        سؤال، پیشنهاد یا مشکلی داری؟ به <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a> ایمیل بزن؛ معمولاً ظرف چند روز جواب می‌دیم.
      </p>

      <h2>سؤال‌های رایج</h2>
      <p><b>برای استفاده باید حساب بسازم؟</b><br />نه. خوندن، کتابخونه، فال، گوش کردن و بازی‌های تکی بدون حساب کار می‌کنن. حساب فقط برای چیزهاییه که سرور لازم دارن: امتیاز و رده‌بندی، دوست‌ها، پیام‌ها و همگام‌سازی دیوان. اون موقع ازت می‌خوایم وارد بشی.</p>
      <p><b>چطور وارد بشم؟</b><br />فقط با اپل یا گوگل. ایمیل و شماره‌ی تلفن نمی‌خوایم، و ایمیلت رو ذخیره هم نمی‌کنیم.</p>
      <p><b>چطور حسابم رو پاک کنم؟</b><br />از اپ: من ← تنظیمات ← پاک کردن حساب. حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. اگه نشد، به hello@yebeyt.com ایمیل بزن و نام کاربریت رو بنویس.</p>
      <p><b>می‌خوام باگ بگم یا ایده بدم.</b><br />گوشی رو تکون بده تا «می‌خوای چیزی بگی؟» باز بشه. می‌تونی باگ، چیزی که اذیتت کرد، ایده، پیشنهاد بازی یا چیزی که خوشت اومد رو بفرستی. می‌تونی همین‌جا هم به hello@yebeyt.com ایمیل بزنی.</p>
      <p><b>یه نفر اذیتم می‌کنه.</b><br />توی صفحه‌ی اون آدم یا کنار پیامش، «بلاک» یا «گزارش» رو بزن. بلاک‌شده دیگه نمی‌تونه بهت پیام بده یا بهت درخواست دوستی بفرسته.</p>
      <p><b>لینک چالش باز نمی‌شه.</b><br />چالش‌ها ۳۰ روز می‌مونن. اگه لینک قدیمی باشه، از دوستت بخواه یه چالش تازه بفرسته.</p>
      <p><b>معنی‌ها از کجا میان؟</b><br />از گنجور. بعضی‌ها با کمک هوش مصنوعی نوشته شدن و کنارشون نشونه‌ی ✦ هست.</p>
      <p><b>صدا پخش نمی‌شه.</b><br />خوانش‌ها از اینترنت پخش می‌شن؛ اتصالت رو چک کن و دکمه‌ی بی‌صدای گوشی رو هم ببین.</p>
    </>
  );
}

function English() {
  return (
    <>
      <h1>Support</h1>
      <p>
        Questions, ideas or a problem? Email <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a>; we usually reply within a few days.
      </p>

      <h2>Common questions</h2>
      <p><b>Do I need an account?</b><br />No. Reading, the library, fal, listening and solo games work without one. An account is only for what needs a server: points and the leaderboard, friends, messages and syncing your divan. We ask you to sign in at that moment.</p>
      <p><b>How do I sign in?</b><br />With Apple or Google only. We don&apos;t ask for an email or a phone number, and we don&apos;t store your email address.</p>
      <p><b>How do I delete my account?</b><br />In the app: Me → Settings → Delete account. Your account and everything you collected is deleted. If that doesn&apos;t work, email hello@yebeyt.com with your username.</p>
      <p><b>I want to report a bug or share an idea.</b><br />Shake your phone to open «می‌خوای چیزی بگی؟» («anything to say?»). You can send a bug, something that annoyed you, an idea, a game suggestion, or something you liked. You can also email hello@yebeyt.com.</p>
      <p><b>Someone is bothering me.</b><br />On that person&apos;s page or next to their message, tap Block or Report. A blocked person can no longer message you or send you a friend request.</p>
      <p><b>A challenge link doesn&apos;t open.</b><br />Challenges last 30 days. If the link is old, ask your friend to send a new challenge.</p>
      <p><b>Where do the meanings come from?</b><br />From Ganjoor. Some were written with AI help and are marked with ✦.</p>
      <p><b>Audio doesn&apos;t play.</b><br />Recitations stream from the internet; check your connection and your phone&apos;s silent switch.</p>
    </>
  );
}
