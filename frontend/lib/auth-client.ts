import { createAuthClient } from "better-auth/react";

// BFF Proxy: Use Vercel domain (or relative path) instead of Render URL
// This ensures all auth requests go through the Next.js proxy
// Environment variable should be set to your Vercel URL in production
const authBaseURL = process.env.NEXT_PUBLIC_AUTH_URL || (
    typeof window !== 'undefined'
        ? window.location.origin  // Use current origin in browser
        : "http://localhost:3000"  // Fallback for SSR
);

export const authClient = createAuthClient({
    baseURL: authBaseURL,
    fetchOptions: {
        credentials: "include",
    },
});

export const { signIn, signUp, signOut, useSession } = authClient;
