import { SectionScreen } from "../../../../../components/library/SectionScreen";

export default async function SectionPage({ params }: { params: Promise<{ path: string[] }> }) {
  return <SectionScreen segments={(await params).path} />;
}
