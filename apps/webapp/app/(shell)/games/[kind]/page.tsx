import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameCover } from "../../../../components/games/GameCover";
import { isPlayable, nameOf, parsePoet, playableKinds } from "../../../../lib/games/kinds";
import { parseInvite } from "../../../../lib/play/routes";

type Props = { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The games with a page of their own besides معمای امروز and جورچین, which have theirs. */
const own = new Set(["daily", "jigsaw"]);

export const dynamicParams = false;

export const generateStaticParams = () => playableKinds.filter((kind) => !own.has(kind)).map((kind) => ({ kind }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  return { title: isPlayable(kind) ? nameOf(kind) : undefined };
}

/** حدس شاعر, مصراع دوم, از کدوم کتاب؟, معنی‌یاب and گوش کن opened by their link: the game is just there (a layer of its own, over the page), and closing goes to the games tab. `?poet=<slug>` makes مصراع دوم a round of that poet, `?invite=<usernames>` the friends a حدس شاعر challenge goes to. Opened inside the app, `@game` shows it instead. */
export default async function QuizPage({ params, searchParams }: Props) {
  const { kind } = await params;
  if (!isPlayable(kind) || own.has(kind)) notFound();
  const query = await searchParams;
  return <GameCover kind={kind} modal={false} poet={kind === "misra" ? parsePoet(query.poet) : undefined} invite={kind === "poet" ? parseInvite(query.invite) : undefined} />;
}
