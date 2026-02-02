import { createAuthClient } from "better-auth/react";

// CRITICAL: Use backend URL directly for OAuth flow
// OAuth must be initiated from the backend domain that owns the session
const authBaseURL = process.env.NEXT_PUBLIC_AUTH_URL || "https://api-gateway-rq2x.onrender.com";

export const authClient = createAuthClient({
    // Point directly to backend - OAuth flow must start from the server that sets cookies
    // sameSite: "none" cookies allow cross-domain session sharing
    baseURL: authBaseURL,
    fetchOptions: {
        credentials: "include", // Send cookies cross-domain
    },
});

export const { signIn, signUp, signOut, useSession } = authClient;
