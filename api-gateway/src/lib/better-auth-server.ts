import { createAuthClient } from "better-auth/client";

// Server-side better-auth client for session validation
export const authClient = createAuthClient({
    baseURL: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
});
