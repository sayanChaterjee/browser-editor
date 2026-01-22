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
    // if (!value.toLowerCase().endsWith("@gmail.com"))
    //   return "Email must be a @gmail.com address";
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
    <div className="h-[calc(100vh-50px)] flex items-center justify-center">
      <div className="w-[360px] bg-[#1b1b1b] rounded-[10px] p-[30px] border border-[#333] shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center">
        <div className="w-[70px] h-[70px] bg-[#333] rounded-full -mt-[60px] mx-auto mb-[10px] flex items-center justify-center text-[30px]">
          <span>🧑‍💻</span>
        </div>

        <h2 className="mb-5 tracking-[2px] font-bold text-white text-lg">CREATE ACCOUNT</h2>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <div className="flex items-center bg-[#2a2a2a] rounded-[5px] p-2.5">
              <span className="mr-2">👤</span>
              <input
                type="text"
                placeholder="Username"
                className="bg-transparent border-none outline-none text-white w-full text-[14px]"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrors({ ...errors, username: validateUsername(e.target.value) });
                }}
              />
            </div>
            {errors.username && <p className="text-red-500 text-[12px] mt-1 text-left">{errors.username}</p>}
          </div>

          <div>
            <div className="flex items-center bg-[#2a2a2a] rounded-[5px] p-2.5">
              <span className="mr-2">📧</span>
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
            {errors.email && <p className="text-red-500 text-[12px] mt-1 text-left">{errors.email}</p>}
          </div>

          <div>
            <div className="flex items-center bg-[#2a2a2a] rounded-[5px] p-2.5">
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
            {errors.password && <p className="text-red-500 text-[12px] mt-1 text-left inline-block w-full">{errors.password}</p>}
          </div>

          <div>
            <div className="flex items-center bg-[#2a2a2a] rounded-[5px] p-2.5">
              <span className="mr-2">🔒</span>
              <input
                type="password"
                placeholder="Confirm Password"
                className="bg-transparent border-none outline-none text-white w-full text-[14px]"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setErrors({ ...errors, confirm: validateConfirm(e.target.value) });
                }}
              />
            </div>
            {errors.confirm && <p className="text-red-500 text-[12px] mt-1 text-left">{errors.confirm}</p>}
          </div>

          <button className="w-full p-2.5 bg-[#00ffcc] text-black border-none rounded-[5px] text-[14px] font-bold cursor-pointer transition-colors hover:bg-[#00e6b8] disabled:opacity-50 disabled:cursor-not-allowed" type="submit" disabled={!isFormValid}>
            Register
          </button>
        </form>

        <p className="mt-5 text-[12px] text-[#aaa]">
          Already have an account?
          <a href="/login" className="text-white font-bold no-underline ml-1 hover:underline"> LOGIN</a>
        </p>
      </div>
    </div>
  );
}
