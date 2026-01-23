"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleForgotPassword = async () => {
    // if (!email.endsWith("@gmail.com")) {
    //   setError("Email must be a @gmail.com address");
    //   return;
    // }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to send reset link");
        return;
      }

      setSuccess(true);
    } catch (error) {
      console.warn('Forgot password attempt failed');
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-50px)] flex items-center justify-center">
      <div className="w-[360px] bg-[#1b1b1b] rounded-[10px] p-[30px] border border-[#333] shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center">
        <div className="w-[70px] h-[70px] bg-[#333] rounded-full -mt-[60px] mx-auto mb-[10px] flex items-center justify-center text-[30px]">
          <span>📧</span>
        </div>
        <h2 className="mb-5 tracking-[2px] font-bold text-white text-lg">FORGOT PASSWORD</h2>

        {!success ? (
          <>
            <p className="text-[12px] text-[#aaa] mb-5">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div className="flex items-center bg-[#2a2a2a] rounded-[5px] mb-[15px] p-2.5">
              <span className="mr-2">👤</span>
              <input
                type="email"
                placeholder="Email"
                className="bg-transparent border-none outline-none text-white w-full text-[14px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500 text-[12px] mb-2 -mt-2 text-left">{error}</p>}

            <button
              className="w-full p-2.5 bg-[#00ffcc] text-black border-none rounded-[5px] text-[14px] font-bold cursor-pointer mt-2.5 transition-colors hover:bg-[#00e6b8] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleForgotPassword}
              disabled={loading || !email}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </>
        ) : (
          <div className="mt-4">
            <p className="text-[#00ffcc] mb-5">
              If an account exists, a reset link has been sent to your email.
            </p>
            <button 
              className="w-full p-2.5 bg-[#00ffcc] text-black border-none rounded-[5px] text-[14px] font-bold cursor-pointer transition-colors hover:bg-[#00e6b8]" 
              onClick={() => router.push("/login")}
            >
              Back to Login
            </button>
          </div>
        )}

        <div className="mt-5 text-[12px] text-[#aaa]">
          Remember your password? <Link href="/login" className="text-white font-bold no-underline ml-1 hover:underline">LOGIN HERE</Link>
        </div>
      </div>
    </div>
  );
}
