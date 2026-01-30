import { useSession as useBetterSession } from "../lib/auth-client";

/**
 * Custom hook to access authentication state
 * Wraps better-auth's useSession hook with convenient methods
 */
export function useAuth() {
    const session = useBetterSession();

    return {
        user: session.data?.user || null,
        isLoading: session.isPending,
        isAuthenticated: !!session.data?.user,
        session: session.data,
    };
}
