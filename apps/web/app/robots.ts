import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  // The link pages are kept out of search results by their own noindex tag; a crawler must be allowed in to read it.
  return { rules: { userAgent: "*", allow: "/" }, host: SITE_URL };
}
