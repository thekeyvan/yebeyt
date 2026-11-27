export const SITE_URL = "https://yebeyt.com";
/** The web app (apps/webapp): the invite page opens a person's page there. */
export const WEBAPP_URL = "https://app.yebeyt.com";
export const SUPPORT_EMAIL = "hello@yebeyt.com";

/**
 * TODO(owner): the App Store id of the app (the digits after `id` in its App Store link), once the app record exists.
 * Until then the buttons open an App Store search and the Smart App Banner tag is left out.
 */
export const APP_STORE_ID = "";
export const APP_STORE_URL = APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : "https://apps.apple.com/search?term=yebeyt";

export const APP_CLIP_BUNDLE_ID = "com.yebeyt.app.Clip";
/** TODO(owner): set to true when the App Clip is in App Store Connect; until then the link pages leave out «همین‌جا بازی کن». */
export const APP_CLIP_READY = false;

/** The backend. Until api.yebeyt.com answers (DNS), the Railway address of the server. */
export const DEFAULT_API_URL = "https://server-production-98f46b7e.up.railway.app";
export const apiUrl = (): string => process.env.API_URL || DEFAULT_API_URL;
