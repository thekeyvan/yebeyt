import { ChallengePage } from "../../../../../components/play/FriendLayers";

/** The board of a challenge opened from inside the app (a link in a chat): it rises over the page it came from, and closing goes back to it. */
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <ChallengePage modal code={(await params).code} />;
}
