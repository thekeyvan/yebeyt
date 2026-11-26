import { MoodScreen } from "../../../../../components/library/MoodScreen";

export default async function MoodPage({ params }: { params: Promise<{ key: string }> }) {
  return <MoodScreen moodKey={(await params).key} />;
}
