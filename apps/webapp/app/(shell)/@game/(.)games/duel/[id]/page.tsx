import { DuelPage } from "../../../../../../components/play/FriendLayers";

/** A game with a friend opened from inside the app (a chat, the lobby, the games tab): it rises over the page it came from, and closing goes back to it. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DuelPage modal id={(await params).id} />;
}
