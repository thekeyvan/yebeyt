import { BRAND, docPath, type Doc, type Lang } from "../lib/site";

/** The two small stickers beside the name. */
export function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

export function Brand({ lang = "fa" }: { lang?: Lang }) {
  return (
    <a className="brand" href={docPath(lang, "")}>
      <Mark />
      <span>{BRAND[lang]}</span>
    </a>
  );
}

/** The top bar of a page that exists in both languages: the name, and a link to the same page in the other language. */
export function TopBar({ lang, doc }: { lang: Lang; doc: Doc }) {
  const other = lang === "fa" ? "en" : "fa";
  return (
    <div className="top">
      <Brand lang={lang} />
      <a className="lang" href={docPath(other, doc)} lang={other}>
        {other === "en" ? "English" : "فارسی"}
      </a>
    </div>
  );
}
