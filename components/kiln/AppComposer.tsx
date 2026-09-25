"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Frame,
  Globe,
  KanbanSquare,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  ShoppingBag,
  Sparkles,
  Table2,
  Users,
  Wand2,
} from "lucide-react";
import { APP_ARCHETYPES } from "@/lib/app-builder/archetypes";
import { cn } from "@/utils/cn";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Sparkles,
  Users,
  ShoppingBag,
  KanbanSquare,
  BookOpen,
  Table2,
  CalendarClock,
  Frame,
  MessagesSquare,
};

export type ComposerMode = "build" | "clone";

interface AppComposerProps {
  /** Which tab opens first. */
  defaultMode?: ComposerMode;
  /** Compact variant for the studio; full variant for the landing hero. */
  size?: "hero" | "compact";
  className?: string;
  /**
   * Called instead of navigating. Lets the /create page handle submission
   * in place rather than bouncing through the router.
   */
  onSubmit?: (input: { mode: ComposerMode; value: string; archetype?: string }) => void;
}

/**
 * The composer is the product's front door, and it has exactly one job:
 * make the two ways in obvious.
 *
 * Upstream had a single URL box, and anything that was not a URL was quietly
 * treated as a web search — so "a CRM for my plumbing business" returned a
 * list of websites to clone rather than building anything. Splitting the
 * modes is what makes building from a description discoverable at all.
 */
export default function AppComposer({
  defaultMode = "build",
  size = "hero",
  className,
  onSubmit,
}: AppComposerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ComposerMode>(defaultMode);
  const [value, setValue] = useState("");
  const [archetype, setArchetype] = useState<string | undefined>();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isHero = size === "hero";
  const canSubmit = value.trim().length > 0;

  const placeholder = useMemo(
    () =>
      mode === "build"
        ? "A CRM for a plumbing business: customers, jobs, scheduled visits and an invoice list…"
        : "https://example.com",
    [mode],
  );

  function pickArchetype(id: string) {
    const next = archetype === id ? undefined : id;
    setArchetype(next);
    if (next) {
      const sample = APP_ARCHETYPES.find((a) => a.id === next)?.samplePrompt ?? "";
      // Only prefill an untouched box — never clobber what someone has typed.
      setValue((current) => (current.trim() ? current : sample));
    }
    inputRef.current?.focus();
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (onSubmit) {
      onSubmit({ mode, value: trimmed, archetype });
      return;
    }

    if (mode === "build") {
      const params = new URLSearchParams({ prompt: trimmed });
      if (archetype) params.set("archetype", archetype);
      router.push(`/create?${params.toString()}`);
    } else {
      sessionStorage.setItem("targetUrl", trimmed);
      sessionStorage.setItem("autoStart", "true");
      router.push("/generation");
    }
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Mode switch. Two real options, weighted equally. */}
      <div
        className="inline-flex items-center gap-4 p-4 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur"
        role="tablist"
        aria-label="How do you want to start?"
      >
        <ModeTab
          active={mode === "build"}
          icon={Wand2}
          label="Describe an app"
          onClick={() => setMode("build")}
        />
        <ModeTab
          active={mode === "clone"}
          icon={Globe}
          label="Rebuild a site"
          onClick={() => setMode("clone")}
        />
      </div>

      {/* Input surface. */}
      <div
        className={cn(
          "mt-16 rounded-[20px] border border-white/10 bg-white/[0.04] backdrop-blur",
          "transition-shadow duration-240 focus-within:border-kiln-iris-400/60",
          "focus-within:shadow-[0_0_0_1px_rgba(98,68,245,0.35),0_24px_60px_-20px_rgba(98,68,245,0.45)]",
        )}
      >
        <label htmlFor="kiln-composer" className="sr-only">
          {mode === "build" ? "Describe the app you want" : "URL to rebuild"}
        </label>

        {mode === "build" ? (
          <textarea
            id="kiln-composer"
            ref={inputRef}
            className={cn(
              "w-full resize-none bg-transparent text-kiln-studio-text placeholder:text-white/35",
              "outline-none",
              isHero ? "p-20 text-[17px] leading-[1.55] min-h-[116px]" : "p-16 text-[15px] min-h-[88px]",
            )}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a newline. Matches every chat UI
              // people already have muscle memory for.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
        ) : (
          <div className="flex items-center gap-12 p-20">
            <Globe className="w-18 h-18 shrink-0 text-white/40" aria-hidden />
            <input
              id="kiln-composer"
              className="w-full bg-transparent text-kiln-studio-text placeholder:text-white/35 outline-none text-[17px]"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-12 px-16 pb-16 pt-4">
          <p className="text-[12.5px] text-white/35">
            {mode === "build"
              ? "Kiln plans the app first. You approve the plan before it writes code."
              : "Rebuilt as componentised React — not a screenshot."}
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              "group inline-flex items-center gap-8 rounded-full px-18 h-40 shrink-0",
              "text-[14px] font-medium transition-all duration-140",
              canSubmit
                ? "bg-kiln-iris-500 text-white hover:bg-kiln-iris-400 active:scale-[0.98]"
                : "bg-white/8 text-white/30 cursor-not-allowed",
            )}
          >
            {mode === "build" ? "Plan it" : "Rebuild it"}
            <ArrowRight
              className="w-16 h-16 transition-transform duration-140 group-hover:translate-x-2"
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Archetypes. Only meaningful when describing an app. */}
      {mode === "build" && (
        <div className="mt-16 flex flex-wrap gap-8">
          {APP_ARCHETYPES.slice(0, 6).map((a) => {
            const Icon = ICONS[a.icon] ?? Sparkles;
            const active = archetype === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => pickArchetype(a.id)}
                aria-pressed={active}
                title={a.description}
                className={cn(
                  "inline-flex items-center gap-8 rounded-full h-34 px-14 text-[13px]",
                  "border transition-colors duration-140",
                  active
                    ? "border-kiln-iris-400/70 bg-kiln-iris-500/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80 hover:border-white/20",
                )}
              >
                <Icon className="w-14 h-14" aria-hidden />
                {a.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-8 rounded-full h-34 px-16 text-[13.5px] font-medium",
        "transition-colors duration-140",
        active ? "bg-white text-kiln-obsidian" : "text-white/55 hover:text-white/85",
      )}
    >
      <Icon className="w-15 h-15" aria-hidden />
      {label}
    </button>
  );
}
