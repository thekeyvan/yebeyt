export type Credit = { name: string; by: string; license: string };
export type CreditGroup = { title: string; credits: Credit[] };

const ofl = "SIL Open Font License 1.1";

/**
 * مجوزها: the fonts, the poetry and the libraries the app uses, from THIRD_PARTY_NOTICES.md (Me/Settings/LicensesScreen.swift). The fonts and the poetry are the
 * phone's lines; the libraries are the web app's own (the phone's GoogleSignIn-iOS is not in it).
 */
export const creditGroups: CreditGroup[] = [
  {
    title: "قلم‌ها",
    credits: [
      { name: "Parastoo, Gandom, Sahel, Shabnam", by: "Saber Rastikerdar", license: ofl },
      { name: "Vazirmatn", by: "The Vazirmatn Project Authors", license: ofl },
      { name: "Lalezar", by: "Borna Izadpanah", license: ofl },
      { name: "Markazi Text", by: "The Markazi Text Project Authors", license: ofl },
      { name: "Noto Naskh Arabic, Noto Nastaliq Urdu", by: "The Noto Project Authors", license: ofl },
    ],
  },
  {
    title: "شعر، معنی‌ها و خوانش‌ها",
    credits: [
      {
        name: "Ganjoor (ganjoor.net)",
        by: "Poems, meanings, summaries, biographies and recitations, through ganjoor's public repositories and API",
        license: "The classical poems are in the public domain",
      },
    ],
  },
  {
    title: "کتابخونه‌ها",
    credits: [
      { name: "Next.js, React, Tailwind CSS, Motion", by: "Vercel, Meta, Tailwind Labs, Matt Perry", license: "MIT License" },
      { name: "UI SDK", by: "Vercel", license: "Apache License 2.0" },
      { name: "modern-screenshot", by: "wxm", license: "MIT License" },
    ],
  },
];
