import type { Metadata } from "next";
import { CatalogScreen } from "../../../../components/games/CatalogScreen";

export const metadata: Metadata = { title: "بازی‌ها" };

export default function CatalogPage() {
  return <CatalogScreen />;
}
