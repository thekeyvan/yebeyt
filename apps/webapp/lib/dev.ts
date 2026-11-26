/** The debug pages (`/dev/…`) exist while developing, and in a build only when it was made with NEXT_PUBLIC_DEV_PAGES=1 (the end-to-end tests). */
export const devPagesEnabled = (): boolean => process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEV_PAGES === "1";
