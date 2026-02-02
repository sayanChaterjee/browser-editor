import { createAuthClient } from "better-auth/react";

const authBaseURL = process.env.NEXT_PUBLIC_AUTH_URL || "https://api-gateway-rq2x.onrender.com";

export const authClient = createAuthClient({
    baseURL: authBaseURL,
    fetchOptions: {
        credentials: "include",
    },
});

export const { signIn, signUp, signOut, useSession } = authClient;
