import type { Metadata } from "next";
import { SearchScreen } from "../../../../components/library/SearchScreen";

export const metadata: Metadata = { title: "جستجو" };

/** `?q=` is what the search starts with (`-beytRoute search:<query>`). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q } = await searchParams;
  return <SearchScreen initial={(Array.isArray(q) ? q[0] : q) ?? ""} />;
}
