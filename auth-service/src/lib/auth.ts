import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import { config } from "../config";

let authInstance: any = null;

export function getAuth() {
    if (!authInstance) {
        if (!mongoose.connection.db) {
            throw new Error("MongoDB connection not established. Cannot initialize better-auth.");
        }

        const baseURL = process.env.BETTER_AUTH_URL;
        if (!baseURL) {
            throw new Error("BETTER_AUTH_URL is not defined in environment variables");
        }

        authInstance = betterAuth({
            database: mongodbAdapter(mongoose.connection.db),

            emailAndPassword: {
                enabled: true,
                autoSignIn: true,
            },

            socialProviders: {
                google: {
                    clientId: process.env.GOOGLE_CLIENT_ID || "",
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
                    enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
                    // BFF Proxy: Callback goes to Vercel, which proxies to Render
                    // Construct dynamically to support local development
                    redirectURI: `${baseURL}/api/auth/callback/google`,
                },
            },

            session: {
                expiresIn: 60 * 60 * 24 * 7,
                updateAge: 60 * 60 * 24,
                cookieCache: {
                    enabled: true,
                    maxAge: 60 * 5,
                },
            },

            cookies: {
                sessionToken: {
                    name: "better-auth.session_token",
                    options: {
                        httpOnly: true,
                        secure: true,
                        sameSite: "lax",  // BFF Proxy: Same-site cookies for maximum security
                        path: "/",
                    },
                },
            },

            advanced: {
                useSecureCookies: true,
                crossSite: {
                    enabled: true, // BFF Proxy: Crucial for session validation through a proxy
                },
                defaultCookieAttributes: {
                    sameSite: "lax",  // BFF Proxy: Same-site for native CSRF protection
                    secure: true,
                    httpOnly: true,
                    path: "/",
                }
            },

            // BFF Proxy: Use Vercel domain as the public-facing URL
            baseURL: baseURL,

            trustedOrigins: [
                "http://localhost:3005",
                "http://localhost:3006",
                "http://localhost:3004",
                "http://localhost:3000",
                baseURL,
                process.env.FRONTEND_URL || "",
            ].filter(Boolean),

            secret: process.env.BETTER_AUTH_SECRET || config.JWT_SECRET,

            redirects: {
                onSignIn: `${baseURL}/editor`,
                onSignUp: `${baseURL}/editor`,
            },
        });
    }

    return authInstance;
}

export type Auth = ReturnType<typeof getAuth>;
