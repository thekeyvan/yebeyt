/**
 * The ids of the sign-in providers, from the environment at build time (they are public): Sign in with Apple's Services ID (`com.yebeyt.web`) and Google's
 * web client id. Until the owner provides them the buttons stay disabled with «ورود روی وب به‌زودی».
 */
export const appleServicesId: string | undefined = process.env.NEXT_PUBLIC_APPLE_SERVICES_ID || undefined;
export const googleClientId: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || undefined;

/** The return URL Sign in with Apple JS is set up with, and the server exchanges the code with: this app's `/auth/apple` (`https://app.yebeyt.com/auth/apple` in production). */
export const appleRedirectUri = (): string => `${location.origin}/auth/apple`;
