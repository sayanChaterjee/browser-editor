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
                    redirectURI: "https://api-gateway-rq2x.onrender.com/api/auth/callback/google"
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

            // Trust the proxy (API Gateway)
            advanced: {
                useSecureCookies: true, // Force secure cookies for Render & Vercel
                defaultCookieAttributes: {
                    sameSite: "none", // Required for cross-site (Vercel -> Render)
                    secure: true,      // SameSite=None REQUIRES Secure=true
                    httpOnly: true,    // Recommended for security
                }
            },

            // Base URL should be the Render API Gateway URL
            baseURL: "https://api-gateway-rq2x.onrender.com",

            // Trusted origins (frontend URLs)
            trustedOrigins: [
                "http://localhost:3005",
                "http://localhost:3006",
                "http://localhost:3004", // Add dev port
                "https://browser-editor-cyan.vercel.app", // Approved Vercel URL
                process.env.FRONTEND_URL || "",
            ].filter(Boolean),

            // Secret for session encryption
            secret: process.env.BETTER_AUTH_SECRET || config.JWT_SECRET,
        });
    }

    return authInstance;
}

// Export type for use in the app
export type Auth = ReturnType<typeof getAuth>;
