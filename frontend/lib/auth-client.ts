import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const authBaseURL = process.env.NEXT_PUBLIC_API_URL || "https://browser-editor-cyan.vercel.app";

export const authClient = createAuthClient({
    // Use frontend URL - Next.js rewrites will proxy /api/* to backend
    // This makes cookies same-site instead of cross-domain
    baseURL: authBaseURL,
    fetchOptions: {
        credentials: "include",
    },
});

export const { signIn, signUp, signOut, useSession } = authClient;
