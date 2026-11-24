import { HomePage } from "../../components/HomePage";
import { docMetadata } from "../../lib/site";

export const metadata = docMetadata("fa", "", "یه بیت · هر بیت، یه بازی", "هر روز یه بیت برای تو، بازی با شعر، و مشاعره با دوستات.");

export default function Home() {
  return <HomePage lang="fa" />;
}
