"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function GlobalSecurity() {
  const pathname = usePathname();

  useEffect(() => {
    // Disable security checks on admin routes to allow inspection
    if (pathname?.startsWith("/admin")) {
      return;
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (
        e.key === "F12" ||
        (ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (ctrlKey && (e.key === "u" || e.key === "U")) ||
        (ctrlKey && (e.key === "s" || e.key === "S"))
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pathname]);

  return null;
}
