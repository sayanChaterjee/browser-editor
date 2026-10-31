/**
 * New accounts by email and password. Off in production (the default): those addresses
 * aren't verified, so new users sign up with Google. identity-service enforces the same rule
 * (EMAIL_SIGN_UP); this only decides whether the sign-up form is shown. Existing email
 * accounts can always log in.
 */
export const EMAIL_SIGN_UP = process.env.NEXT_PUBLIC_EMAIL_SIGN_UP === "true";
