import type { Metadata } from "next";
import { PeopleScreen } from "../../../components/friends/PeopleScreen";

export const metadata: Metadata = { title: "پیدا کردن دوست" };

/** `?q=` is what the search starts with (`-beytRoute people:<text>`). */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q } = await searchParams;
  return <PeopleScreen initial={(Array.isArray(q) ? q[0] : q) ?? ""} />;
}
