import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import mongoose from "mongoose";
import { config } from "../config";
import { publishUserEvent } from "../events/publisher";
import { lockoutAfterSignIn, lockoutBeforeSignIn } from "./loginLockout";

let authInstance: any = null;

export function getAuth() {
    if (!authInstance) {
        if (!mongoose.connection.db) {
            throw new Error("MongoDB connection not established. Cannot initialize better-auth.");
        }

        const baseURL = config.BETTER_AUTH_URL;

        authInstance = betterAuth({
            database: mongodbAdapter(mongoose.connection.db),

            emailAndPassword: {
                enabled: true,
                autoSignIn: true,
            },

            // Profile and moderation fields live on Better Auth's own user record, so there's
            // one user collection. input: false keeps them out of sign-up/update-user bodies.
            user: {
                additionalFields: {
                    warningCount: { type: "number", defaultValue: 0, input: false },
                    banned: { type: "boolean", defaultValue: false, input: false },
                },
            },

            // Per-email lockout after repeated failed sign-ins (password guessing from many IPs)
            hooks: {
                before: lockoutBeforeSignIn,
                after: lockoutAfterSignIn,
            },

            databaseHooks: {
                // Runs after the user is committed (email sign-up and first Google sign-in)
                user: {
                    create: {
                        after: async (user) => {
                            publishUserEvent("user.registered.v1", {
                                userId: user.id,
                                name: user.name,
                                registeredAt: new Date(user.createdAt).toISOString(),
                            });
                        },
                    },
                },
                // A banned user can't start a session (sign-in, sign-up or OAuth).
                session: {
                    create: {
                        before: async (session) => {
                            const ctx = await authInstance.$context;
                            const user = await ctx.internalAdapter.findUserById(session.userId);
                            if (user?.banned) {
                                throw new APIError("FORBIDDEN", { message: "This account has been banned" });
                            }
                        },
                    },
                },
            },

            socialProviders: {
                google: {
                    clientId: config.GOOGLE_CLIENT_ID,
                    clientSecret: config.GOOGLE_CLIENT_SECRET,
                    enabled: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
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
                config.FRONTEND_URL,
            ].filter(Boolean),

            secret: config.BETTER_AUTH_SECRET,

            redirects: {
                onSignIn: `${baseURL}/practice`,
                onSignUp: `${baseURL}/practice`,
            },
        });
    }

    return authInstance;
}

export type Auth = ReturnType<typeof getAuth>;
