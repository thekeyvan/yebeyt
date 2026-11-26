import type { Metadata } from "next";
import { ReaderScreen } from "../../../../../components/reader/ReaderScreen";
import { poemMetadata } from "../../../../../lib/reader/metadata";
import { parseRoute } from "../../../../../lib/reader/route";

type Props = { params: Promise<{ path: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const routeOf = async ({ params, searchParams }: Props) => parseRoute((await params).path, await searchParams);

export async function generateMetadata(props: Props): Promise<Metadata> {
  return poemMetadata(await routeOf(props));
}

/** A poem opened from inside the app: the reader rises over the page it came from, which stays under it, and closing goes back to it. */
export default async function PoemOverPage(props: Props) {
  return <ReaderScreen route={await routeOf(props)} modal />;
}
