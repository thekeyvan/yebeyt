import { PoetScreen } from "../../../../../components/library/PoetScreen";

export default async function PoetPage({ params }: { params: Promise<{ slug: string }> }) {
  return <PoetScreen slug={(await params).slug} />;
}
