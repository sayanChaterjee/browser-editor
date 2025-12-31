"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://localhost:3001/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: username,   
          email,
          password,
        }),
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        console.error("Non-JSON response:", text);
        alert("Unexpected server response");
        return;
      }

      if (!res.ok) {
        alert(data.message || "Invalid input");
        return;
      }

      alert("Registration successful 🎉");
      window.location.href = "/login";

    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">

        <div className="avatar">
          <span>🧑‍💻</span>
        </div>

        <h2>CREATE ACCOUNT</h2>

        <form onSubmit={handleRegister}>
          <div className="input-group">
            <span className="icon">👤</span>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <span className="icon">📧</span>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <span className="icon">🔒</span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <span className="icon">🔒</span>
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button className="login-btn" type="submit">
            Register
          </button>
        </form>

        <p className="register-text">
          Already have an account?
          <a href="/login"> LOGIN</a>
        </p>

      </div>
    </div>
  );
}
