import Link from "next/link";
import { GridBackgroundDemo } from "@/components/home/GridBackground";
import { FloatingDockDemo } from "@/components/home/FloatingDock";
import { CodeBlockDemo } from "@/components/home/CodeBlock";

export default function Home() {
  return (
    <GridBackgroundDemo>
      <FloatingDockDemo />
      <div className="absolute inset-x-0 inset-y-[-20%] flex justify-center items-center opacity-40 blur-[0.5px] pointer-events-none select-none z-0 overflow-hidden">
        <div className="w-full max-w-4xl h-full md:block hidden -rotate-6 flex flex-col justify-center">
          <CodeBlockDemo />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-7">
                   <img src="/logo.svg" alt="logo" className="w-28 md:w-36 mb-4"/>
        <h1 className="mb-6 text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-500 py-4">
          Code The Canvas
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 font-bold max-w-2xl mb-10">
          Create, edit, and preview your code in real-time with our modern, secure, and intuitive browser-based environment.
        </p>
        <div className="flex flex-wrap justify-center gap-5">
          <Link 
            href="/editor" 
            className="px-8 py-3 bg-[#22c53d] text-black rounded-full font-bold text-base transition-all hover:bg-[#39FF14] hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(0,255,204,0.3)]"
          >
            Start Coding
          </Link>
          <Link 
            href="/register" 
            className="px-8 py-3 border-2 border-[#22c525] text-[#22c525] rounded-full font-bold text-base transition-all hover:bg-[#39FF14] hover:text-black hover:scale-105 active:scale-95"
          >
            Join Now
          </Link>
        </div>
      </div>
    </GridBackgroundDemo>
  );
}