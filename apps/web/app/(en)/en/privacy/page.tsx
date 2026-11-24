import { DocPage } from "../../../../components/DocPage";
import { docMetadata } from "../../../../lib/site";

export const metadata = docMetadata("en", "privacy", "Privacy Policy", "What yebeyt stores, where and why.");

/** An HTML comment in the page's source (a JSX comment would not reach the HTML). */
const DraftNote = () => <div hidden dangerouslySetInnerHTML={{ __html: "<!-- draft for the owner's review -->" }} />;

export default function Privacy() {
  return (
    <>
      <DraftNote />
      <DocPage lang="en" doc="privacy">
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
          <li>The identifier Apple or Google gives us for your account. We do not store your email address. The app shows you the name Apple or Google gives it as a suggestion, but only the display name you keep is stored on our server. For Sign in with Apple we also keep an encrypted token so we can revoke the sign-in when you delete your account.</li>
          <li>Your username, the display name you kept (optional) and the face you built. These three are public: anyone with your invite link (yebeyt.com/i/…) can see them, and they are shown as the maker on the page of a challenge or game link you create.</li>
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
          <li><b>Ganjoor:</b> the text of poems that are not bundled comes from Ganjoor&apos;s public repository on GitHub (raw.githubusercontent.com), the list of recitations from api.ganjoor.net, and the audio files themselves from i.ganjoor.net. These requests carry no account information, but those services, like any website, see the IP address and browser of whoever asks.</li>
          <li><b>Poets' pictures</b> come from our own server and carry no account information.</li>
          <li><b>Apple and Google:</b> only when you choose to sign in with them.</li>
        </ul>

        <h2>Ads and tracking</h2>
        <p>There are no ads and we use no tracking or analytics tools, neither in the app nor on this website. This website sets no cookies.</p>

        <h2>IP addresses and logs</h2>
        <p>For every request our server logs only the method, the route, the status and the time; no IP address, no username, no content. An IP address is never stored with a report or with feedback. Our host (Railway) itself sees the visitor&apos;s IP address and browser in its own request logs for a short time, as part of running the network.</p>

        <h2>Links and the clipboard</h2>
        <p>
          When you press the install button on the page of a link (a challenge, an invite or a game), the address of that link is copied to the clipboard of your own phone. The first time the app opens, it checks whether your clipboard holds a yebeyt.com link and, if so, offers to open that challenge or invite. This check happens on your phone; nothing from your clipboard reaches us, except opening that same link.
        </p>

        <h2>Where it is kept</h2>
        <p>The yebeyt server and database, and this website, are hosted on Railway, in a data centre in Europe.</p>

        <h2>Deleting your account</h2>
        <p>
          In the app: Me → Settings → Delete account. This revokes your Sign in with Apple and deletes from our server: your account, divan, points and league places, follows, likes and reposts, blocks, your challenges and your results on other people's challenges, shared divans, and every chat you were in with all its messages (the other person loses that chat too). A game waiting for a second player is deleted, and a game in progress ends with your opponent as the winner. Finished games stay for your opponent, but the couplets you played are no longer linked to you. What stays: reports you filed or that name you, and your feedback; neither is linked to your account any more.
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
      </DocPage>
    </>
  );
}
