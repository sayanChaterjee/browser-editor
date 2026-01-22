"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const handleResetPassword = async () => {
    if (!token) {
      setError("Reset token is missing");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to reset password");
        return;
      }

      alert("Password reset successfully! Please login with your new password.");
      router.push("/login");
    } catch (error) {
      console.error(error);
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="h-[calc(100vh-50px)] flex items-center justify-center">
        <div className="w-[360px] bg-[#1b1b1b] rounded-[10px] p-[30px] border border-[#333] shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center">
          <div className="w-[70px] h-[70px] bg-[#333] rounded-full -mt-[60px] mx-auto mb-[10px] flex items-center justify-center text-[30px]">
            <span>⚠️</span>
          </div>
          <h2 className="mb-5 tracking-[2px] font-bold text-white text-lg">INVALID LINK</h2>
          <p className="text-[#ff5555] mb-5">
            This password reset link is invalid or has expired.
          </p>
          <button 
            className="w-full p-2.5 bg-[#00ffcc] text-black border-none rounded-[5px] text-[14px] font-bold cursor-pointer transition-colors hover:bg-[#00e6b8]" 
            onClick={() => router.push("/forgot-password")}
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-50px)] flex items-center justify-center">
      <div className="w-[360px] bg-[#1b1b1b] rounded-[10px] p-[30px] border border-[#333] shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center">
        <div className="w-[70px] h-[70px] bg-[#333] rounded-full -mt-[60px] mx-auto mb-[10px] flex items-center justify-center text-[30px]">
          <span>🔒</span>
        </div>
        <h2 className="mb-5 tracking-[2px] font-bold text-white text-lg">RESET PASSWORD</h2>
        <p className="text-[12px] text-[#aaa] mb-5">
          Enter your new password below.
        </p>

        <div className="flex items-center bg-[#2a2a2a] rounded-[5px] mb-[15px] p-2.5">
          <span className="mr-2">🔒</span>
          <input
            type="password"
            placeholder="New Password"
            className="bg-transparent border-none outline-none text-white w-full text-[14px]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex items-center bg-[#2a2a2a] rounded-[5px] mb-[15px] p-2.5">
          <span className="mr-2">🔒</span>
          <input
            type="password"
            placeholder="Confirm Password"
            className="bg-transparent border-none outline-none text-white w-full text-[14px]"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-red-500 text-[12px] mb-2 -mt-2 text-left">{error}</p>}

        <button
          className="w-full p-2.5 bg-[#00ffcc] text-black border-none rounded-[5px] text-[14px] font-bold cursor-pointer transition-colors hover:bg-[#00e6b8] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleResetPassword}
          disabled={loading || !password || !confirmPassword}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
