import { DocPage } from "../../../../components/DocPage";
import { docMetadata } from "../../../../lib/site";

export const metadata = docMetadata("en", "support", "Support", "Questions, ideas or a problem?");

export default function Support() {
  return (
    <DocPage lang="en" doc="support">
      <h1>Support</h1>
      <p>
        Questions, ideas or a problem? Email <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a>; we usually reply within a few days.
      </p>

      <h2>Common questions</h2>
      <p><b>Do I need an account?</b><br />No. Reading, the library, fal, listening and solo games work without one. An account is only for what needs a server: points and the leaderboard, friends, messages and syncing your divan. We ask you to sign in at that moment.</p>
      <p><b>How do I sign in?</b><br />With Apple or Google only. You don&apos;t type an email or a phone number; we keep the email Apple or Google gives us (the privacy page explains).</p>
      <p><b>How do I delete my account?</b><br />In the app: Me → Settings → Delete account. Your account and everything you collected is deleted. If that doesn&apos;t work, email hello@yebeyt.com with your username.</p>
      <p><b>I want to report a bug or share an idea.</b><br />Shake your phone to open «می‌خوای چیزی بگی؟» («anything to say?»). You can send a bug, something that annoyed you, an idea, a game suggestion, or something you liked. You can also email hello@yebeyt.com.</p>
      <p><b>Someone is bothering me.</b><br />On that person&apos;s page or next to their message, tap Block or Report. A blocked person can no longer message you or send you a friend request.</p>
      <p><b>A challenge link doesn&apos;t open.</b><br />Challenges last 30 days. If the link is old, ask your friend to send a new challenge.</p>
      <p><b>Where do the meanings come from?</b><br />From Ganjoor. Some were written with AI help and are marked with ✦.</p>
      <p><b>Audio doesn&apos;t play.</b><br />Recitations stream from the internet; check your connection and your phone&apos;s silent switch.</p>
    </DocPage>
  );
}
