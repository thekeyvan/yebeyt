import { docPath, type Lang } from "../lib/site";

const TEXT = {
  fa: { privacy: "حریم خصوصی", terms: "شرایط استفاده", support: "پشتیبانی", credit: "شعرها و معنی‌ها از", ganjoor: "گنجور" },
  en: { privacy: "Privacy", terms: "Terms", support: "Support", credit: "Poems and meanings from", ganjoor: "Ganjoor" },
};

export function SiteFooter({ lang = "fa" }: { lang?: Lang }) {
  const t = TEXT[lang];
  return (
    <footer className="footer">
      <nav>
        <a href={docPath(lang, "privacy")}>{t.privacy}</a>
        <a href={docPath(lang, "terms")}>{t.terms}</a>
        <a href={docPath(lang, "support")}>{t.support}</a>
        <a href="https://github.com/thekeyvan/yebeyt">GitHub</a>
      </nav>
      <div>
        {t.credit} <a href="https://ganjoor.net">{t.ganjoor}</a> · <a href="mailto:hello@yebeyt.com">hello@yebeyt.com</a>
      </div>
    </footer>
  );
}
