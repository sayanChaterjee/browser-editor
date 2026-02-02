import { cn } from "@/lib/utils";
import React from "react";

interface GridBackgroundProps {
  children?: React.ReactNode;
}

export function GridBackgroundDemo({ children }: GridBackgroundProps) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-white dark:bg-black overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 z-0",
          "[background-size:40px_40px]",
          "[background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
          "dark:[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]",
        )}
      />
      {/* Radial gradient for the container to give a faded look */}
      <div className="pointer-events-none absolute inset-0 z-1 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black"></div>
      
      <div className="relative z-20 w-full">
        {children}
      </div>
    </div>
  );
}
