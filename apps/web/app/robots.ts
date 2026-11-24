import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/config";

export default function robots(): MetadataRoute.Robots {
  // The link pages are for one person each; keep them out of search results.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/c/", "/i/", "/g/"] }, host: SITE_URL };
}
