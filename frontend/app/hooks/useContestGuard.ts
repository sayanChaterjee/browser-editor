"use client";

import { useEffect, useRef } from "react";

export function useContestGuard(onTerminate: () => void, onWarning?: () => void) {
  const strikes = useRef(0);

  useEffect(() => {
    const violate = () => {
      strikes.current += 1;

      if (strikes.current >= 2) {
        onTerminate();
      } else {
        if (onWarning) onWarning();
        requestFS();
      }
    };

    const requestFS = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    };

    const onFsChange = () => {
      if (!document.fullscreenElement) violate();
    };

    const onVisibility = () => {
      if (document.hidden) violate();
    };

    const onBlur = () => violate();

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [onTerminate, onWarning]);
}
