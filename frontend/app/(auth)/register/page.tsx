"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [errors, setErrors] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });


  const validateUsername = (value: string) => {
    if (value.length < 3)
      return "Username must be at least 3 characters";
    return "";
  };

  const validateEmail = (value: string) => {
    if (!value.toLowerCase().endsWith("@gmail.com"))
      return "Email must be a @gmail.com address";
    return "";
  };
const validatePassword = (value: string) => {
  if (value.length < 6)
    return "Password must be at least 6 characters";

  if (!/(?=.*[a-z])/.test(value))
    return "Password must contain a lowercase letter";

  if (!/(?=.*[A-Z])/.test(value))
    return "Password must contain an uppercase letter";

  if (!/(?=.*\d)/.test(value))
    return "Password must contain a number";

  if (!/(?=.*[@$!%*?&#_])/.test(value))
    return "Password must contain a special character";

  return "";
};


  const validateConfirm = (value: string) => {
    if (value !== password) return "Passwords do not match";
    return "";
  };



  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: validateConfirm(confirm),
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some((err) => err !== "")) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        alert("Unexpected server response");
        return;
      }

      if (!res.ok) {
        alert(data.message || "Invalid input");
        return;
      }

      alert("Registration successful 🎉");
      window.location.href = "/login";
    } catch {
      alert("Server error");
    }
  };

  const isFormValid =
    !validateUsername(username) &&
    !validateEmail(email) &&
    !validatePassword(password) &&
    !validateConfirm(confirm);

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
              onChange={(e) => {
                setUsername(e.target.value);
                setErrors({ ...errors, username: validateUsername(e.target.value) });
              }}
            />
          </div>
          {errors.username && <p className="error-text">{errors.username}</p>}

          <div className="input-group">
            <span className="icon">📧</span>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({ ...errors, email: validateEmail(e.target.value) });
              }}
            />
          </div>
          {errors.email && <p className="error-text">{errors.email}</p>}

          <div className="input-group">
            <span className="icon">🔒</span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors({ ...errors, password: validatePassword(e.target.value) });
              }}
            />
          </div>
          {errors.password && <p className="error-text">{errors.password}</p>}

          <div className="input-group">
            <span className="icon">🔒</span>
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors({ ...errors, confirm: validateConfirm(e.target.value) });
              }}
            />
          </div>
          {errors.confirm && <p className="error-text">{errors.confirm}</p>}

          <button className="login-btn" type="submit" disabled={!isFormValid}>
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
