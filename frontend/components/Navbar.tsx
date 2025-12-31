"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    router.push("/login");
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="logo">CodeEditor</span>
      </div>

      <div className="nav-right">
        <Link href="/" className={pathname === "/" ? "active" : ""}>
          Home
        </Link>

        <Link href="/editor" className={pathname === "/editor" ? "active" : ""}>
          Editor
        </Link>

        {!isLoggedIn && (
          <>
            <Link href="/login" className={pathname === "/login" ? "active" : ""}>
              Login
            </Link>

            <Link
              href="/register"
              className={pathname === "/register" ? "active" : ""}
            >
              Register
            </Link>
          </>
        )}

        {isLoggedIn && (
          <>
            <span className="user-logo" title="Logged in">
              👤
            </span>

            <button className="logout-btn" onClick={logout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
