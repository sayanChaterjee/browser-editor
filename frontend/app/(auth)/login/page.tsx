"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });

  const router = useRouter();


  const validateEmail = (value: string) => {
    // if (!value.endsWith("@gmail.com"))
    //   return "Email must be a @gmail.com address";
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/auth/login`, {
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
      // Set cookie for middleware access
      document.cookie = `token=${data.accessToken}; path=/; max-age=86400; SameSite=Strict`;
      
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
    <div className="h-[calc(100vh-50px)] flex items-center justify-center">
      <div className="w-[360px] bg-[#1b1b1b] rounded-[10px] p-[30px] border border-[#333] shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center">
        <div className="w-[70px] h-[70px] bg-[#333] rounded-full -mt-[60px] mx-auto mb-[10px] flex items-center justify-center text-[30px]">
          <span>👤</span>
        </div>
        <h2 className="mb-5 tracking-[2px] font-bold text-white">MEMBER LOGIN</h2>

        <div className="flex items-center bg-[#2a2a2a] rounded-[5px] mb-[15px] padding-[10px] p-2.5">
          <span className="mr-2">👤</span>
          <input
            type="email"
            placeholder="Email"
            className="bg-transparent border-none outline-none text-white w-full text-[14px]"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors({ ...errors, email: validateEmail(e.target.value) });
            }}
          />
        </div>
        {errors.email && <p className="text-red-500 text-[12px] mb-2 -mt-2 text-left">{errors.email}</p>}

        <div className="flex items-center bg-[#2a2a2a] rounded-[5px] mb-[15px] padding-[10px] p-2.5">
          <span className="mr-2">🔒</span>
          <input
            type="password"
            placeholder="Password"
            className="bg-transparent border-none outline-none text-white w-full text-[14px]"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors({ ...errors, password: validatePassword(e.target.value) });
            }}
          />
        </div>
        {errors.password && <p className="text-red-500 text-[12px] mb-2 -mt-2 text-left">{errors.password}</p>}

        <button
          className="w-full p-[10px] bg-[#00ffcc] text-black border-none rounded-[5px] text-[14px] font-bold cursor-pointer mt-[10px] transition-colors hover:bg-[#00e6b8] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleLogin}
          disabled={!isFormValid}
        >
          Login
        </button>

        <div className="flex justify-between text-[12px] mt-3 text-[#aaa]">
          <Link href="/forgot-password" title="Forgot Password" className="text-[#aaa] no-underline hover:underline">Forgot Password</Link>
        </div>

        <div className="mt-5 text-[12px] text-[#aaa]">
          Don't have an account? <a href="/register" className="text-white font-bold no-underline ml-1 hover:underline">REGISTER HERE</a>
        </div>
      </div>
    </div>
  );
}
