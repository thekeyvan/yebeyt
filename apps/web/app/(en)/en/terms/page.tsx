import { DocPage } from "../../../../components/DocPage";
import { docMetadata } from "../../../../lib/site";

export const metadata = docMetadata("en", "terms", "Terms of Use", "Terms of use for yebeyt.");

export default function Terms() {
  return (
    <DocPage lang="en" doc="terms">
      <h1>Terms of Use</h1>
      <p className="muted">Last updated: 24 November 2026</p>
      <p>yebeyt is free and made for enjoying Persian poetry. By using the app you agree to the following:</p>
      <ul>
        <li><b>Content:</b> poems come from Ganjoor&apos;s open library. Meanings (especially those marked with ✦) were written with AI help and may contain mistakes; use authoritative sources for scholarly work.</li>
        <li><b>Accounts:</b> an account is optional. You are responsible for the security of your Apple or Google account. You can delete your yebeyt account from inside the app at any time.</li>
        <li><b>What you write:</b> messages, notes beside couplets, your display name and username are yours, and you are responsible for them. Abuse, harassment, threats, advertising, and repeated or unwanted messages are not allowed. You may not use another person&apos;s name, picture or username.</li>
        <li><b>Reports and enforcement:</b> anyone can block or report a person or a message. We review reports, and we may remove content, limit or block an account, or take back a username, in most cases without warning if needed.</li>
        <li><b>Acceptable use:</b> don&apos;t use the app or its server to cause harm, abuse it, cheat in the scores, or gain unauthorized access.</li>
        <li><b>No warranty:</b> the app is provided &ldquo;as is&rdquo;. We try to keep it running but it may sometimes be unavailable.</li>
        <li><b>Open source:</b> the app&apos;s code is published under the MIT license on <a href="https://github.com/thekeyvan/yebeyt">GitHub</a>.</li>
        <li><b>Changes:</b> if these terms change, the date at the top of this page is updated.</li>
      </ul>
      <p>What we do with your data is in the <a href="/en/privacy">Privacy Policy</a>. Questions? <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a></p>
    </DocPage>
  );
}
