"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "../../../lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });

  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      router.push("/editor");
    }
  }, [session, isPending, router]);




  const validateEmail = (value: string) => {
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    return "";
  };



  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    const newErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };

    setErrors(newErrors);

    if (newErrors.email || newErrors.password) return;
    if (isLoading) return; // Prevent double submission

    setIsLoading(true);

    try {
      const { signIn } = await import("../../../lib/auth-client");
      
      console.log("Attempting login with:", email);
      const result = await signIn.email({
        email,
        password,
      });

      console.log("Login result:", result);

      // Check if there's an error in the result
      if (result?.error) {
        console.error("Login error:", result.error);
        alert(result.error.message || "Invalid login credentials");
        setIsLoading(false);
        return;
      }

      // Check if login was successful (better-auth returns data on success)
      if (result?.data) {
        console.log("Login successful, redirecting...");
        window.dispatchEvent(new Event("authChange"));
        
        // Give the browser a moment to set the cookie
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try multiple redirect methods
        try {
          router.refresh();
          router.push("/editor");
        } catch (e) {
          console.error("Router redirect failed, using window.location", e);
          window.location.href = "/editor";
        }
      } else {
        console.error("Unexpected response:", result);
        alert("Login failed - unexpected response");
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login attempt failed:', error);
      alert("Server error: " + (error instanceof Error ? error.message : String(error)));
      setIsLoading(false);
    }
  };

  const isFormValid =
    !validateEmail(email) && !validatePassword(password);

  if (isPending) {
    return (
      <div className="h-[calc(100vh-50px)] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

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
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>

        <div className="flex items-center my-5">
           <div className="flex-1 border-t border-[#333]"></div>
           <span className="px-3 text-[#aaa] text-[12px]">OR</span>
           <div className="flex-1 border-t border-[#333]"></div>
        </div>

        <button
          className="w-full p-[10px] bg-white text-black border-none rounded-[5px] text-[14px] font-bold cursor-pointer flex items-center justify-center gap-2 hover:bg-[#f0f0f0] transition-colors"
          onClick={async () => {
            try {
              const { signIn } = await import("../../../lib/auth-client");
              await signIn.social({
                provider: "google",
                callbackURL: "https://browser-editor-cyan.vercel.app/editor",
              });
            } catch (error) {
              console.error("Google login failed:", error);
            }
          }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-[18px] h-[18px]" />
          Continue with Google
        </button>

        <div className="mt-5 text-[12px] text-[#aaa]">
          Don't have an account? <a href="/register" className="text-white font-bold no-underline ml-1 hover:underline">REGISTER HERE</a>
        </div>
      </div>
    </div>
  );
}
