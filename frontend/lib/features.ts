/**
 * Username/password forms on the sign-in pages. Off in production (the default), where
 * everyone signs in with Google; on for local development. identity-service enforces the
 * same rule (EMAIL_PASSWORD_AUTH); this only decides whether the forms are shown.
 */
export const EMAIL_PASSWORD_AUTH = process.env.NEXT_PUBLIC_EMAIL_PASSWORD_AUTH === "true";
