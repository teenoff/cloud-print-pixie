import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ModeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      className={[
        "relative inline-flex items-center h-9 w-16 rounded-full border border-border/60",
        "bg-background/40 backdrop-blur-xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]",
        "hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 size-8 rounded-full grid place-items-center",
          "bg-gradient-to-br from-primary to-accent text-primary-foreground",
          "shadow-md transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isDark ? "translate-x-7" : "translate-x-0",
        ].join(" ")}
      >
        <Sun
          className={`absolute size-4 transition-all duration-500 ${isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"}`}
        />
        <Moon
          className={`absolute size-4 transition-all duration-500 ${isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"}`}
        />
      </span>
      <Sun className="size-3.5 text-muted-foreground absolute left-2.5" />
      <Moon className="size-3.5 text-muted-foreground absolute right-2.5" />
    </button>
  );
}
