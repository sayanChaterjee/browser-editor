"use client";

import React, { useEffect, useState } from "react";
import { FloatingDock } from "@/components/ui/floating-dock";
import {
  IconBrandGithub,
  IconBrandX,
  IconExchange,
  IconHome,
  IconNewSection,
  IconTerminal2,
  IconUser,
  IconLogin,
  IconUserPlus,
  IconLogout,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";

export function FloatingDockDemo() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const links = [
    {
      title: "Home",
      icon: (
        <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "/",
    },
    {
      title: "Editor",
      icon: (
        <IconTerminal2 className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "/editor",
    },
    ...(isLoggedIn
      ? [
          {
            title: "Profile",
            icon: (
              <IconUser className="h-full w-full text-neutral-500 dark:text-neutral-300" />
            ),
            href: "/profile",
          },
          {
            title: "Logout",
            icon: (
              <IconLogout className="h-full w-full text-neutral-500 dark:text-neutral-300" />
            ),
            href: "#",
            onClick: handleLogout,
          },
        ]
      : [
          {
            title: "Login",
            icon: (
              <IconLogin className="h-full w-full text-neutral-500 dark:text-neutral-300" />
            ),
            href: "/login",
          },
          {
            title: "Register",
            icon: (
              <IconUserPlus className="h-full w-full text-neutral-500 dark:text-neutral-300" />
            ),
            href: "/register",
          },
        ]),
    {
      title: "GitHub",
      icon: (
        <IconBrandGithub className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "https://github.com",
    },
  ];

  return (
    <div className="fixed top-6 left-0 right-0 flex items-center justify-center z-[1000]">
      <FloatingDock
        items={links}
      />
    </div>
  );
}
