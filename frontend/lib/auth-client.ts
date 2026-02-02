import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const authBaseURL = baseURL.endsWith("/api/auth") ? baseURL : `${baseURL.replace(/\/$/, "")}/api/auth`;

export const authClient = createAuthClient({
    baseURL: authBaseURL,
    // CRITICAL: Enable credentials for cross-origin requests
    fetchOptions: {
        credentials: "include", // Send cookies with cross-origin requests
        headers: {
            "Content-Type": "application/json",
        },
    },
});

export const { signIn, signUp, signOut, useSession } = authClient;
