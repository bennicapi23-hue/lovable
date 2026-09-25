"use client";

import { useState } from "react";
import {
  Boxes,
  Check,
  Database,
  Layers,
  Package,
  Palette,
  Pencil,
  RefreshCw,
  Route,
} from "lucide-react";
import type { AppBlueprint } from "@/lib/app-builder/blueprint";
import { cn } from "@/utils/cn";

interface BlueprintViewProps {
  blueprint: AppBlueprint;
  onBuild: (blueprint: AppBlueprint) => void;
  onReplan: () => void;
  building?: boolean;
}

/**
 * The approval step.
 *
 * Showing the plan is not decoration — it is the cheapest possible moment to
 * catch a misunderstanding. Correcting "you planned a booking app, I wanted a
 * rota" here costs one click; catching it after generation costs a full build.
 * So the plan is presented as something to check, with the name editable in
 * place and every assumption visible.
 */
export default function BlueprintView({
  blueprint,
  onBuild,
  onReplan,
  building = false,
}: BlueprintViewProps) {
  const [name, setName] = useState(blueprint.name);
  const [editingName, setEditingName] = useState(false);

  const d = blueprint.design;
  const coreFeatures = blueprint.features.filter((f) => f.priority === "core");
  const otherFeatures = blueprint.features.filter((f) => f.priority !== "core");

  return (
    <div className="w-full max-w-[880px] mx-auto">
      {/* Identity */}
      <header className="mb-32">
        <div className="flex items-start gap-12">
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
              }}
              className="text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] bg-transparent border-b border-kiln-iris-400/60 outline-none text-white w-full"
              aria-label="App name"
            />
          ) : (
            <h1 className="group text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] text-white">
              {name}
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="ml-12 align-middle text-white/25 hover:text-white/70 transition-colors"
                aria-label="Rename app"
              >
                <Pencil className="w-18 h-18 inline" />
              </button>
            </h1>
          )}
        </div>
        <p className="mt-8 text-[17px] text-white/55">{blueprint.tagline}</p>
        <p className="mt-16 text-[15px] leading-[1.6] text-white/70 max-w-[62ch]">
          {blueprint.summary}
        </p>
        <p className="mt-12 text-[13px] text-white/40">
          Built for <span className="text-white/65">{blueprint.audience}</span>
        </p>
      </header>

      <div className="grid gap-16 md:grid-cols-2">
        {/* Design direction — palette shown, not described. */}
        <Panel icon={Palette} title="Design direction" className="md:col-span-2">
          <p className="text-[14.5px] leading-[1.6] text-white/75">{d.direction}</p>

          <div className="mt-16 flex flex-wrap items-center gap-10">
            {(
              [
                ["Primary", d.palette.primary],
                ["Accent", d.palette.accent],
                ["Background", d.palette.background],
                ["Surface", d.palette.surface],
                ["Text", d.palette.text],
              ] as const
            ).map(([label, hex]) => (
              <div key={label} className="flex items-center gap-8">
                <span
                  className="w-24 h-24 rounded-8 border border-white/15 shrink-0"
                  style={{ backgroundColor: hex }}
                  aria-hidden
                />
                <span className="text-[12px] text-white/45">
                  {label}
                  <span className="ml-6 font-mono text-white/70">{hex}</span>
                </span>
              </div>
            ))}
          </div>

          <dl className="mt-16 flex flex-wrap gap-x-24 gap-y-8 text-[12.5px]">
            <Meta label="Type" value={`${d.typography.display} / ${d.typography.body}`} />
            <Meta label="Density" value={d.density} />
            <Meta label="Corners" value={d.radius} />
            <Meta label="Theme" value={d.darkMode ? "Dark-first" : "Light-first"} />
            <Meta label="Mood" value={d.mood.join(", ")} />
          </dl>
        </Panel>

        {/* Screens */}
        <Panel icon={Route} title={`Screens (${blueprint.pages.length})`}>
          <ol className="space-y-12">
            {blueprint.pages.map((p) => (
              <li key={`${p.name}-${p.route}`}>
                <div className="flex items-baseline gap-8">
                  <span className="text-[14px] font-medium text-white">{p.name}</span>
                  <code className="text-[11.5px] font-mono text-kiln-iris-300">{p.route}</code>
                </div>
                <p className="mt-2 text-[13px] text-white/50">{p.purpose}</p>
                {p.sections.length > 0 && (
                  <p className="mt-4 text-[12px] text-white/35">{p.sections.join(" · ")}</p>
                )}
              </li>
            ))}
          </ol>
        </Panel>

        {/* Data model */}
        <Panel icon={Database} title="Data model">
          {blueprint.dataModel.length === 0 ? (
            <p className="text-[13px] text-white/40">
              No stored entities — state comes from interaction.
            </p>
          ) : (
            <ul className="space-y-12">
              {blueprint.dataModel.map((e) => (
                <li key={e.entity}>
                  <span className="text-[14px] font-medium text-white">{e.entity}</span>
                  <p className="mt-2 text-[12px] font-mono text-white/45 leading-[1.6]">
                    {e.fields.map((f) => `${f.name}: ${f.type}`).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* What must work */}
        <Panel icon={Check} title="What will work">
          <ul className="space-y-8">
            {coreFeatures.map((f) => (
              <li key={f.name} className="flex gap-8">
                <Check
                  className="w-14 h-14 mt-3 shrink-0 text-kiln-success"
                  aria-hidden
                />
                <span className="text-[13.5px] text-white/75">
                  <span className="text-white">{f.name}</span> — {f.description}
                </span>
              </li>
            ))}
          </ul>
          {otherFeatures.length > 0 && (
            <p className="mt-14 text-[12.5px] text-white/40">
              Also planned: {otherFeatures.map((f) => f.name).join(", ")}
            </p>
          )}
        </Panel>

        {/* Build surface */}
        <Panel icon={Layers} title="Build">
          <dl className="space-y-10 text-[13px]">
            <Row icon={Boxes} label="Components" value={`${blueprint.components.length} files`} />
            <Row
              icon={Package}
              label="Packages"
              value={blueprint.packages.length ? blueprint.packages.join(", ") : "None extra"}
            />
          </dl>
          {blueprint.notes.length > 0 && (
            <ul className="mt-16 space-y-6 border-t border-white/8 pt-14">
              {blueprint.notes.map((n, i) => (
                <li key={i} className="text-[12.5px] text-white/45 leading-[1.55]">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Commit */}
      <div className="mt-32 flex flex-wrap items-center gap-12">
        <button
          type="button"
          disabled={building}
          onClick={() => onBuild({ ...blueprint, name })}
          className={cn(
            "inline-flex items-center gap-10 h-48 px-24 rounded-full text-[15px] font-medium",
            "bg-kiln-iris-500 text-white transition-all duration-140",
            building
              ? "opacity-70 cursor-wait"
              : "hover:bg-kiln-iris-400 active:scale-[0.99]",
          )}
        >
          {building ? (
            <>
              <RefreshCw className="w-16 h-16 animate-spin" aria-hidden />
              Starting the build…
            </>
          ) : (
            <>
              Build this app
              <span aria-hidden>→</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReplan}
          disabled={building}
          className="inline-flex items-center gap-8 h-48 px-20 rounded-full text-[14px] border border-white/12 text-white/70 hover:text-white hover:border-white/25 transition-colors disabled:opacity-40"
        >
          <RefreshCw className="w-15 h-15" aria-hidden />
          Plan again
        </button>

        <p className="text-[12.5px] text-white/35">
          You can change anything once it is running.
        </p>
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-16 border border-white/8 bg-white/[0.025] p-20",
        className,
      )}
    >
      <h2 className="flex items-center gap-8 text-[12px] uppercase tracking-[0.08em] text-white/40 mb-14">
        <Icon className="w-14 h-14" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-white/35">{label}: </dt>
      <dd className="inline text-white/70 capitalize">{value}</dd>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-8">
      <Icon className="w-14 h-14 mt-3 shrink-0 text-white/35" aria-hidden />
      <div>
        <dt className="inline text-white/40">{label}: </dt>
        <dd className="inline text-white/75">{value}</dd>
      </div>
    </div>
  );
}
