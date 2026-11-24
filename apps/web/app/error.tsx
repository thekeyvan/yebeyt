"use client";

import { Missing } from "../components/Missing";

/** Shown when the server behind a link page does not answer (a lookup that fails, not one that finds nothing). */
export default function ErrorPage() {
  return <Missing title="الان نشد" hint="چند لحظه‌ی دیگه دوباره امتحان کن." />;
}
