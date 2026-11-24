import { HomePage } from "../../../components/HomePage";
import { docMetadata } from "../../../lib/site";

export const metadata = docMetadata("en", "", "yebeyt · Every couplet, a game", "A new couplet every day, games with poetry, and mosha'ere (poetry duels) with your friends.");

export default function Home() {
  return <HomePage lang="en" />;
}
