import type { Metadata } from "next";
import { LicensesScreen } from "../../../../components/me/LicensesScreen";

export const metadata: Metadata = { title: "مجوزها" };

export default function Page() {
  return <LicensesScreen />;
}
