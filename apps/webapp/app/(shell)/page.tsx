import type { Metadata } from "next";
import { Page } from "../../components/shell/Page";

export const metadata: Metadata = { title: { absolute: "یه بیت" } };

export default function HomePage() {
  return <Page title="خونه" />;
}
