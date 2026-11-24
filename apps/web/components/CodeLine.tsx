"use client";

import { useState } from "react";
import { copyText } from "../lib/clipboard";

/** The code of a link page and a button that copies it. */
export function CodeLine({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="code">
      <span>
        {label}: <b dir="ltr">{code}</b>
      </span>
      <button
        type="button"
        className="copy"
        onClick={async () => {
          setCopied(await copyText(code));
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "کپی شد" : "کپی"}
      </button>
    </span>
  );
}
