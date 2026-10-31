"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWakeBackend } from "@/components/WakeBackend";
import { forgetUser } from "@/lib/session";
import { AuthCard, FieldError, FormMessage, GoogleButton, OrDivider } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function RegisterPage() {
  // Start the backend now: by the time the form is sent, it is awake
  useWakeBackend();
  // Someone may be about to sign in as a different user: practice mustn't open the previous
  // user's local copy for them (lib/session)
  useEffect(forgetUser, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formMessage, setFormMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const [errors, setErrors] = useState({
    username: "",
    password: "",
    confirm: "",
  });


  const validateUsername = (value: string) => {
    if (value.length < 3)
      return "Username must be at least 3 characters";
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
    setFormMessage(null);

    const newErrors = {
      username: validateUsername(username),
      password: validatePassword(password),
      confirm: validateConfirm(confirm),
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some((err) => err !== "")) return;

    try {
      const { signUp } = await import("../../../lib/auth-client");
      
      const generatedEmail = `${username}@local.host`;
      const result = await signUp.email({
        email: generatedEmail,
        password,
        name: username,
      });

      if (result.error) {
        setFormMessage({ text: result.error.message || "Registration failed", type: "error" });
        return;
      }

      setFormMessage({ text: "Account created. Redirecting...", type: "success" });
      setTimeout(() => {
        window.location.href = "/practice";
      }, 1000);
    } catch (error) {
      console.warn("Registration attempt failed:", error);
      setFormMessage({ text: "Server error. Please try again later.", type: "error" });
    }
  };

  const isFormValid =
    !validateUsername(username) &&
    !validatePassword(password) &&
    !validateConfirm(confirm);

  const signInWithGoogle = async () => {
    try {
      const { signIn } = await import("../../../lib/auth-client");
      await signIn.social({
        provider: "google",
        callbackURL: window.location.origin + "/practice",
      });
    } catch (error) {
      console.error("Google login failed:", error);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start coding in seconds. No setup needed."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <FormMessage message={formMessage} />
      <form onSubmit={handleRegister} className="space-y-4">
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
            autoComplete="new-password"
            className="mt-1.5"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors({ ...errors, password: validatePassword(e.target.value) });
              setFormMessage(null);
            }}
          />
          <FieldError>{errors.password}</FieldError>
          {!errors.password && (
            <p className="mt-1.5 text-[12px] text-subtle-foreground">
              6+ characters with upper and lower case, a number and a symbol.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setErrors({ ...errors, confirm: validateConfirm(e.target.value) });
              setFormMessage(null);
            }}
          />
          <FieldError>{errors.confirm}</FieldError>
        </div>
        <Button type="submit" variant="primary" className="h-10 w-full" disabled={!isFormValid}>
          Create account
        </Button>
      </form>
      <OrDivider />
      <GoogleButton onClick={signInWithGoogle} />
    </AuthCard>
  );
}
