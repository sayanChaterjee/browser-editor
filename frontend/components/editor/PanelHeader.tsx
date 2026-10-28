/** The thin title bar on top of each editor pane (preview, console, question). */
export default function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">{title}</span>
      {children && <div className="flex items-center gap-1">{children}</div>}
    </div>
  );
}

export function PanelIconButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="flex size-6 items-center justify-center rounded text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
      {...props}
    >
      {children}
    </button>
  );
}
