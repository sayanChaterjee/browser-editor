"use client";

import React from "react";
import { FloatingDock } from "@/components/ui/floating-dock";
import {
  IconBrandGithub,
  IconHome,
  IconTerminal2,
  IconUser,
  IconLogin,
  IconUserPlus,
  IconLogout,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth-client";

export function FloatingDockDemo() {
  const { isAuthenticated, isLoading } = useAuth();

  const handleLogout = async () => {
    await signOut();
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
    ...(isLoading
      ? []
      : isAuthenticated
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
    // {
    //   title: "GitHub",
    //   icon: (
    //     <IconBrandGithub className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    //   ),
    //   href: "https://github.com",
    // },
  ];

  return (
    <div className="fixed top-6 left-0 right-0 flex items-center justify-center z-[1000]">
      <FloatingDock items={links} />
    </div>
  );
}
