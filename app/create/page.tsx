"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import AppComposer from "@/components/kiln/AppComposer";
import BlueprintView from "@/components/kiln/BlueprintView";
import KilnLogo from "@/components/brand/KilnLogo";
import KilnMark from "@/components/brand/KilnMark";
import type { AppBlueprint } from "@/lib/app-builder/blueprint";
import { appConfig } from "@/config/app.config";
import { describeApiError } from "@/lib/api-error";

type Phase = "composing" | "planning" | "reviewing" | "handing-off";

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>("composing");
  const [blueprint, setBlueprint] = useState<AppBlueprint | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Held so "Plan again" can re-run with the same inputs.
  const lastRequest = useRef<{ prompt: string; archetype?: string } | null>(null);
  // Guards against the effect firing twice under React strict mode.
  const autoPlanned = useRef(false);

  const plan = useCallback(async (prompt: string, archetype?: string) => {
    lastRequest.current = { prompt, archetype };
    setPhase("planning");
    setError(null);

    try {
      const response = await fetch("/api/generate-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          archetype,
          model: appConfig.ai.defaultModel,
        }),
      });

      if (!response.ok) {
        // Quota and rate-limit refusals carry a reason and a way out.
        throw new Error(await describeApiError(response, "The planner could not run."));
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "The planner did not return a plan.");
      }

      setBlueprint(data.blueprint as AppBlueprint);
      setPhase("reviewing");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      setPhase("composing");
      toast.error(message);
    }
  }, []);

  // A description handed over from the landing composer plans immediately.
  useEffect(() => {
    if (autoPlanned.current) return;
    const prompt = searchParams.get("prompt");
    if (!prompt?.trim()) return;
    autoPlanned.current = true;
    void plan(prompt.trim(), searchParams.get("archetype") ?? undefined);
  }, [searchParams, plan]);

  const build = useCallback(
    async (approved: AppBlueprint) => {
      setPhase("handing-off");

      // Record the project before building, so the work is recoverable even
      // if the build itself fails or the tab is closed mid-stream.
      let projectId: string | null = null;
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: approved.name,
            tagline: approved.tagline,
            origin: "create",
            source: lastRequest.current?.prompt ?? approved.summary,
            blueprint: approved,
          }),
        });
        if (response.ok) {
          projectId = (await response.json()).project?.id ?? null;
        }
      } catch {
        // A failed save must not block the build — the user came here to
        // build, and an unsaved project is better than no project.
        console.warn("[create] could not save the project; building anyway");
      }

      try {
        // The studio reads these on mount. sessionStorage rather than a query
        // string because a blueprint is far larger than a URL should carry.
        sessionStorage.setItem("kilnBlueprint", JSON.stringify(approved));
        sessionStorage.setItem("kilnBuildMode", "create");
        sessionStorage.setItem(
          "kilnBuildPrompt",
          lastRequest.current?.prompt ?? approved.summary,
        );
        sessionStorage.setItem("autoStart", "true");
        router.push(projectId ? `/generation?project=${projectId}` : "/generation");
      } catch {
        setPhase("reviewing");
        toast.error("Could not hand the plan to the studio. Check browser storage settings.");
      }
    },
    [router],
  );

  return (
    <main className="min-h-screen bg-kiln-obsidian text-kiln-studio-text">
      <BackdropGlow />

      <header className="relative z-10 border-b border-white/6">
        <div className="mx-auto max-w-[1100px] px-24 h-64 flex items-center justify-between">
          <span className="text-white">
            <KilnLogo markClassName="w-22 h-22" variant="gradient" />
          </span>
          <a
            href="/projects"
            className="text-[13.5px] text-white/50 hover:text-white transition-colors"
          >
            Your projects →
          </a>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1100px] px-24 py-64">
        {phase === "composing" && (
          <div className="max-w-[720px] mx-auto">
            <h1 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.03em] text-white">
              What are we building?
            </h1>
            <p className="mt-12 text-[16px] leading-[1.6] text-white/55 max-w-[52ch]">
              Describe it the way you would to a colleague. Kiln writes a plan
              first — screens, data, design direction — and you approve it
              before any code is generated.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-24 flex items-start gap-10 rounded-12 border border-kiln-danger/30 bg-kiln-danger/10 p-14"
              >
                <AlertCircle className="w-16 h-16 mt-2 shrink-0 text-kiln-danger" aria-hidden />
                <p className="text-[13.5px] text-white/80">{error}</p>
              </div>
            )}

            <div className="mt-32">
              <AppComposer
                defaultMode="build"
                onSubmit={({ mode, value, archetype }) => {
                  if (mode === "clone") {
                    sessionStorage.setItem("targetUrl", value);
                    sessionStorage.setItem("autoStart", "true");
                    router.push("/generation");
                    return;
                  }
                  void plan(value, archetype);
                }}
              />
            </div>
          </div>
        )}

        {phase === "planning" && <PlanningState />}

        {(phase === "reviewing" || phase === "handing-off") && blueprint && (
          <BlueprintView
            blueprint={blueprint}
            building={phase === "handing-off"}
            onBuild={(approved) => { void build(approved); }}
            onReplan={() => {
              const last = lastRequest.current;
              if (last) void plan(last.prompt, last.archetype);
              else setPhase("composing");
            }}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Planning takes a few seconds. Rather than a spinner, name the steps — it
 * makes the wait legible and sets expectations about what is being decided.
 */
function PlanningState() {
  const steps = [
    "Reading the description",
    "Choosing the screens",
    "Shaping the data",
    "Picking a visual direction",
  ];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setActive((i) => (i + 1 < steps.length ? i + 1 : i)),
      1400,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="max-w-[520px] mx-auto py-64 text-center">
      <KilnMark className="w-56 h-56 mx-auto text-white" variant="firing" />
      <h2 className="mt-24 text-[22px] font-medium text-white">Planning your app</h2>
      <ul className="mt-24 space-y-10 text-left inline-block">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-10 text-[14px] transition-colors duration-480 ${
              i <= active ? "text-white/80" : "text-white/25"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full shrink-0 ${
                i < active
                  ? "bg-kiln-success"
                  : i === active
                    ? "bg-kiln-glow-500 animate-pulse"
                    : "bg-white/15"
              }`}
              aria-hidden
            />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ambient brand light. Purely decorative, so it is hidden from assistive tech. */
function BackdropGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full opacity-[0.16] blur-[140px] bg-[radial-gradient(circle,#6244f5_0%,transparent_65%)]" />
      <div className="absolute top-[20%] -right-[10%] w-[520px] h-[520px] rounded-full opacity-[0.08] blur-[120px] bg-[radial-gradient(circle,#f2b441_0%,transparent_65%)]" />
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-kiln-obsidian" aria-busy="true" />}
    >
      <CreatePageInner />
    </Suspense>
  );
}
