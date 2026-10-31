import { Spinner } from "./spinner";

/** Shown while a page is on its way (route loading.tsx files): immediate feedback on navigation. */
export default function PageLoader({ label = "Loading…", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 bg-background ${fullScreen ? "min-h-screen" : "min-h-[calc(100vh-56px)]"}`}
    >
      <Spinner className="size-5" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
