"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) return alert(data.message || "Invalid login credentials");

      localStorage.setItem("accessToken", data.accessToken);
      alert("Login successful");
      window.location.href = "/editor";
    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="avatar"><span>👤</span></div>
        <h2>MEMBER LOGIN</h2>

        <div className="input-group">
          <span className="icon">👤</span>
          <input
            type="text"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <span className="icon">🔒</span>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="login-btn" onClick={handleLogin}>Login</button>

        <div className="login-options">
          <label><input type="checkbox" /> Remember me?</label>
          <a href="#">Forgot Password</a>
        </div>

        <div className="register-text">
          Don’t have an account? <a href="/register">REGISTER HERE</a>
        </div>

      </div>
    </div>
  );
}
