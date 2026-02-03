"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * OAuth Callback Handler
 * 
 * This page handles the OAuth callback after successful authentication.
 * It ensures cookies are properly set before redirecting to the editor.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Give the browser time to process and store cookies from the OAuth callback
    const timer = setTimeout(() => {
      console.log('[OAuth Callback] Redirecting to /editor after cookie storage');
      router.push('/editor');
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#38bdf8] mx-auto mb-4"></div>
        <p className="text-lg">Completing sign in...</p>
      </div>
    </div>
  );
}
