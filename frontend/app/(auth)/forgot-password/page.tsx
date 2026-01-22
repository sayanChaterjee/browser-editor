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
      console.error(error);
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="avatar"><span>📧</span></div>
        <h2>FORGOT PASSWORD</h2>

        {!success ? (
          <>
            <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div className="input-group">
              <span className="icon">👤</span>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="error-text">{error}</p>}

            <button
              className="login-btn"
              onClick={handleForgotPassword}
              disabled={loading || !email}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </>
        ) : (
          <div className="success-message">
            <p style={{ color: '#00ffcc', marginBottom: '20px' }}>
              If an account exists, a reset link has been sent to your email.
            </p>
            <button className="login-btn" onClick={() => router.push("/login")}>
              Back to Login
            </button>
          </div>
        )}

        <div className="register-text">
          Remember your password? <Link href="/login">LOGIN HERE</Link>
        </div>
      </div>
    </div>
  );
}
