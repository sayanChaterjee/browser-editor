"use client";

import React, { useEffect, useState } from "react";
import { IconDeviceLaptop, IconArrowRight } from "@tabler/icons-react";

export default function DeviceRestriction({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[100000] bg-black flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#00ffcc]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        
        <div className="relative z-10 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <IconDeviceLaptop className="w-10 h-10 text-[#00ffcc]" />
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
            Desktop Experience Only
          </h2>
          
          <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
            CodeEditor is a professional environment designed for large displays. Please switch to a laptop or desktop computer to continue.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-neutral-500 justify-center text-sm bg-neutral-900/50 py-3 px-4 rounded-xl border border-neutral-800/50">
              <span className="w-2 h-2 rounded-full bg-[#00ffcc] animate-pulse" />
              Optimization for mobile in progress
            </div>
            
            <a 
              href="https://github.com/sayanChaterjee/browser-editor" 
              target="_blank"
              className="inline-flex items-center gap-2 text-[#00ffcc] hover:underline font-medium pt-4 transition-all"
            >
              Star on GitHub <IconArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
        
        {/* Aesthetics: Tilted Code snippet background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none -z-1 flex items-center justify-center rotate-12 scale-150">
           <pre className="text-xs text-white">
             {`function Restricted() {
  const [device, setDevice] = useState("mobile");
  
  if (device === "mobile") {
    return <Redirect to="desktop" />;
  }
  
  return (
    <IDE>
      <Editor />
      <Preview />
    </IDE>
  );
}`}
           </pre>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
