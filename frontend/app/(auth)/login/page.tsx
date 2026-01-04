"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });

  const router = useRouter();


  const validateEmail = (value: string) => {
    if (!value.endsWith("@gmail.com"))
      return "Email must be a @gmail.com address";
    return "";
  };

  const validatePassword = (value: string) => {
    if (value.length < 6)
      return "Password must be at least 6 characters";
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#_])/.test(value))
      return "Password must be strong";
    return "";
  };



  const handleLogin = async () => {
    const newErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };

    setErrors(newErrors);

    if (newErrors.email || newErrors.password) return;

    try {
      const res = await fetch("http://localhost:3001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Invalid login credentials");
        return;
      }

      localStorage.setItem("token", data.accessToken);
      window.dispatchEvent(new Event("authChange"));
      alert("Login successful");
      router.push("/editor");
    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  const isFormValid =
    !validateEmail(email) && !validatePassword(password);

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="avatar"><span>👤</span></div>
        <h2>MEMBER LOGIN</h2>

        <div className="input-group">
          <span className="icon">👤</span>
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

        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={!isFormValid}
        >
          Login
        </button>

        <div className="login-options">
          <a href="#">Forgot Password</a>
        </div>

        <div className="register-text">
          Don't have an account? <a href="/register">REGISTER HERE</a>
        </div>
      </div>
    </div>
  );
}
