import type { Metadata } from "next";
import { AllPoetsScreen } from "../../../../components/library/AllPoetsScreen";

export const metadata: Metadata = { title: "شاعرها" };

export default function PoetsPage() {
  return <AllPoetsScreen />;
}
