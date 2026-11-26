import type { MetadataRoute } from "next";
import { colors } from "../lib/tokens";

/** Lets people add the web app to their home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "یه بیت",
    short_name: "یه بیت",
    description: "شعر فارسی، بازی با بیت‌ها و مشاعره با دوستات.",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: colors.paper,
    theme_color: colors.paper,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
