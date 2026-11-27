import type { Metadata } from "next";
import { ChallengePage } from "../../../components/play/FriendLayers";

export const metadata: Metadata = { title: "چالش" };

/** The board of a challenge opened by its link (`yebeyt.com/c/<code>` has «روی وب بازی کن» to it): anybody can play it, with or without an account. Opened inside the app (from a chat), `@game` shows it instead. */
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <ChallengePage modal={false} code={(await params).code} />;
}
