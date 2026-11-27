import { Brand } from "./Brand";
import { CodeLine } from "./CodeLine";
import { Avatar } from "./Avatar";
import { SiteFooter } from "./SiteFooter";
import { StoreButton } from "./StoreButton";
import { APP_CLIP_READY } from "../lib/config";
import type { ChallengeView, LinkView } from "../lib/links";

/** The page of /c, /i and /g (the ChallengeWeb board): who sent it, what it is, the two buttons and the code. */
export function LinkPage({ view, appClip = APP_CLIP_READY }: { view: LinkView | ChallengeView; appClip?: boolean }) {
  const versus = "mine" in view ? view : null;
  return (
    <div className="page">
      <div className="top">
        <Brand />
      </div>
      <main className="link">
        {versus ? (
          <div className="versus">
            <span className="player">
              <Avatar avatar={view.avatar} />
              {view.name}
              <span className="score">{versus.mine}</span>
            </span>
            <span className="vs">در برابر</span>
            <span className="player you">
              <span className="avatar unknown" aria-hidden="true">
                ؟
              </span>
              تو<span className="score">{versus.yours}</span>
            </span>
          </div>
        ) : (
          <div>
            <Avatar avatar={view.avatar} large />
          </div>
        )}
        <div className="headline">
          <h1>{view.heading}</h1>
          <p>{view.description}</p>
        </div>
        {appClip && (
          <>
            <a className="button primary" href={view.url}>
              همین‌جا بازی کن
            </a>
            <p className="note">بدون نصب؛ چند ثانیه طول می‌کشه</p>
          </>
        )}
        <StoreButton pageUrl={view.url} primary={!appClip} />
        {view.webUrl && (
          <a className="button secondary" href={view.webUrl}>
            {view.webLabel ?? "روی وب باز کن"}
          </a>
        )}
        <p className="after">
          {view.after}
          <br />
          <CodeLine label={view.codeLabel} code={view.code} />
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
