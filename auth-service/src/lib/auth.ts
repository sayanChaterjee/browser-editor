import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import { config } from "../config";

// Lazy initialization - create auth instance after DB connection
let authInstance: any = null;

export function getAuth() {
    if (!authInstance) {
        if (!mongoose.connection.db) {
            throw new Error("MongoDB connection not established. Cannot initialize better-auth.");
        }

        authInstance = betterAuth({
            database: mongodbAdapter(mongoose.connection.db),

            // Email and password authentication
            emailAndPassword: {
                enabled: true,
                autoSignIn: true,
            },

            // Social authentication providers
            socialProviders: {
                google: {
                    clientId: process.env.GOOGLE_CLIENT_ID || "",
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
                    enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
                    // CRITICAL: Use Vercel URL to maintain same-site context
                    // Next.js rewrites will proxy this to the actual backend
                    redirectURI: "https://browser-editor-cyan.vercel.app/api/auth/callback/google"
                },
            },

            // Session configuration
            session: {
                expiresIn: 60 * 60 * 24 * 7, // 7 days
                updateAge: 60 * 60 * 24,
                cookieCache: {
                    enabled: true,
                    maxAge: 60 * 5,
                },
            },

            // Trust the proxy (API Gateway + Next.js rewrites)
            advanced: {
                useSecureCookies: true,
                crossSite: {
                    enabled: true, // Required for split-domain proxy setups
                },
                defaultCookieAttributes: {
                    sameSite: "lax",      // Works because baseURL = Vercel domain
                    secure: true,
                    httpOnly: true,
                }
            },

            // CRITICAL: Use Vercel URL so cookies are scoped to the domain users see
            // Next.js rewrites proxy /api/* to the actual backend
            baseURL: "https://browser-editor-cyan.vercel.app",

            // Trusted origins
            trustedOrigins: [
                "http://localhost:3005",
                "http://localhost:3006",
                "http://localhost:3004",
                "https://browser-editor-cyan.vercel.app",
                process.env.FRONTEND_URL || "",
            ].filter(Boolean),

            // Secret for session encryption
            secret: process.env.BETTER_AUTH_SECRET || config.JWT_SECRET,

            // Redirect to frontend after OAuth
            redirects: {
                onSignIn: "https://browser-editor-cyan.vercel.app/editor",
                onSignUp: "https://browser-editor-cyan.vercel.app/editor",
            },
        });
    }

    return authInstance;
}

// Export type for use in the app
export type Auth = ReturnType<typeof getAuth>;
