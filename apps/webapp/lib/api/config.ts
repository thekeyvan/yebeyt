/** The server the web app's `/api` route asks (on Railway; app.yebeyt.com reaches the same one as api.yebeyt.com). */
export const defaultApiUrl = "https://server-production-98f46b7e.up.railway.app";

export const apiUrl = (): string => process.env.API_URL || defaultApiUrl;
