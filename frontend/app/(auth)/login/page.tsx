"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "../../../lib/auth-client";
import { AuthCard, FieldError, FormMessage, GoogleButton, OrDivider } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ username: "", password: "" });
  const [formMessage, setFormMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      router.push("/editor");
    }
  }, [session, isPending, router]);

  const validateUsername = (value: string) => {
    if (!value) return "Username is required";
    if (value.length < 3) return "Username must be at least 3 characters";
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    return "";
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setFormMessage(null);

    const newErrors = {
      username: validateUsername(username),
      password: validatePassword(password),
    };

    setErrors(newErrors);

    if (newErrors.username || newErrors.password) return;
    if (isLoading) return; 

    setIsLoading(true);

    try {
      const { signIn } = await import("../../../lib/auth-client");
      
      const generatedEmail = `${username}@local.host`;
      console.log("Attempting login with:", username);
      const result = await signIn.email({
        email: generatedEmail,
        password,
      });

      console.log("Login result:", result);

      if (result?.error) {
        console.error("Login error:", result.error);
        setFormMessage({ text: result.error.message || "Invalid login credentials", type: "error" });
        setIsLoading(false);
        return;
      }

      if (result?.data) {
        console.log("Login successful, redirecting...");
        window.dispatchEvent(new Event("authChange"));
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          router.refresh();
          router.push("/editor");
        } catch (e) {
          console.error("Router redirect failed, using window.location", e);
          window.location.href = "/editor";
        }
      } else {
        console.error("Unexpected response:", result);
        setFormMessage({ text: "Login failed — unexpected response", type: "error" });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login attempt failed:', error);
      setFormMessage({ text: "Server error: " + (error instanceof Error ? error.message : String(error)), type: "error" });
      setIsLoading(false);
    }
  };

  const isFormValid =
    !validateUsername(username) && !validatePassword(password);

  const signInWithGoogle = async () => {
    try {
      const { signIn } = await import("../../../lib/auth-client");
      await signIn.social({
        provider: "google",
        callbackURL: window.location.origin + "/editor",
      });
    } catch (error) {
      console.error("Google login failed:", error);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <AuthCard
      title="Log in to CEditor"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <FormMessage message={formMessage} />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            className="mt-1.5"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrors({ ...errors, username: validateUsername(e.target.value) });
              setFormMessage(null);
            }}
          />
          <FieldError>{errors.username}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1.5"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors({ ...errors, password: validatePassword(e.target.value) });
              setFormMessage(null);
            }}
          />
          <FieldError>{errors.password}</FieldError>
        </div>
        <Button type="submit" variant="primary" className="h-10 w-full" disabled={!isFormValid || isLoading}>
          {isLoading ? <Spinner className="border-primary-foreground/30 border-t-primary-foreground" /> : "Log in"}
        </Button>
      </form>
      <OrDivider />
      <GoogleButton onClick={signInWithGoogle} />
    </AuthCard>
  );
}
