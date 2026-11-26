import { BookScreen } from "../../../../../components/library/BookScreen";

export default async function BookPage({ params }: { params: Promise<{ path: string[] }> }) {
  return <BookScreen segments={(await params).path} />;
}
