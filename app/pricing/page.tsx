"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import SiteHeader from "@/components/marketing/SiteHeader";
import SiteFooter from "@/components/marketing/SiteFooter";
import {
  PLANS,
  annualSaving,
  formatLimit,
  monthlyEquivalent,
  type Plan,
} from "@/config/plans.config";
import { brand } from "@/config/brand.config";
import { cn } from "@/utils/cn";

type Billing = "monthly" | "annual";

/** Rows of the comparison table, read straight off the plan limits. */
const COMPARISON: Array<{
  label: string;
  value: (plan: Plan) => string;
}> = [
  { label: "Builds a month", value: (p) => formatLimit(p.limits.buildsPerMonth) },
  { label: "Edits a month", value: (p) => formatLimit(p.limits.editsPerMonth) },
  { label: "Concurrent sandboxes", value: (p) => formatLimit(p.limits.concurrentSandboxes) },
  { label: "Sandbox session", value: (p) => `${p.limits.sandboxMinutes} min` },
  { label: "Seats included", value: (p) => formatLimit(p.limits.seats) },
  { label: "Project history", value: (p) => formatLimit(p.limits.projectHistory) },
];

/** Capabilities compared across plans, by entitlement key. */
const CAPABILITIES: Array<{ label: string; key: string }> = [
  { label: "Export source", key: "export" },
  { label: "Rebuild from a URL", key: "clone" },
  { label: "Bring your own model keys", key: "byok" },
  { label: "Private projects", key: "private-projects" },
  { label: "GitHub export", key: "github-export" },
  { label: "Version history", key: "version-history" },
  { label: "Shared workspace", key: "shared-workspace" },
  { label: "Roles and permissions", key: "rbac" },
  { label: "Audit log", key: "audit-log" },
  { label: "SSO and SCIM", key: "sso" },
  { label: "Self-hosted", key: "self-host" },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div className="min-h-screen bg-kiln-obsidian text-kiln-studio-text antialiased">
      <SiteHeader />

      <section className="relative overflow-hidden pt-140 pb-56">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-[40%] left-1/2 -translate-x-1/2 w-[900px] h-[640px] rounded-full opacity-[0.14] blur-[140px] bg-[radial-gradient(circle,#6244f5_0%,transparent_65%)]" />
        </div>

        <div className="relative mx-auto max-w-[1160px] px-24 text-center">
          <h1 className="text-[clamp(36px,5.4vw,56px)] leading-[1.05] font-semibold tracking-[-0.03em] text-white">
            Pay for builds, not seats
          </h1>
          <p className="mt-20 text-[17px] leading-[1.6] text-white/55 max-w-[54ch] mx-auto">
            A build is one generation pass — a new app, or a rebuild of a site.
            That is what costs us model tokens and sandbox time, so that is what
            we charge for. Edits are metered separately and far more generously.
          </p>

          <BillingToggle value={billing} onChange={setBilling} />
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-24 pb-72">
        <div className="grid gap-16 lg:grid-cols-4 md:grid-cols-2">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} billing={billing} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-24 pb-96">
        <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-white mb-24">
          Everything compared
        </h2>

        <div className="overflow-x-auto rounded-16 border border-white/8">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <caption className="sr-only">Plan comparison</caption>
            <thead>
              <tr className="bg-white/[0.03]">
                <th scope="col" className="p-16 text-[13px] font-medium text-white/45">
                  Plan
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className="p-16 text-[14px] font-medium text-white"
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label} className="border-t border-white/6">
                  <th
                    scope="row"
                    className="p-16 text-[13.5px] font-normal text-white/55"
                  >
                    {row.label}
                  </th>
                  {PLANS.map((p) => (
                    <td key={p.id} className="p-16 text-[13.5px] text-white/75">
                      {row.value(p)}
                    </td>
                  ))}
                </tr>
              ))}

              {CAPABILITIES.map((cap) => (
                <tr key={cap.key} className="border-t border-white/6">
                  <th
                    scope="row"
                    className="p-16 text-[13.5px] font-normal text-white/55"
                  >
                    {cap.label}
                  </th>
                  {PLANS.map((p) => {
                    const has = p.entitlements.includes(cap.key);
                    return (
                      <td key={p.id} className="p-16">
                        {has ? (
                          <>
                            <Check
                              className="w-16 h-16 text-kiln-success"
                              aria-hidden
                            />
                            <span className="sr-only">Included</span>
                          </>
                        ) : (
                          <>
                            <Minus className="w-16 h-16 text-white/20" aria-hidden />
                            <span className="sr-only">Not included</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-20 text-[13px] text-white/35">
          Prices in EUR, excluding VAT. Self-hosting {brand.name} on your own
          infrastructure means your model and sandbox costs are billed by those
          providers directly.
        </p>
      </section>

      <Faq />
      <SiteFooter />
    </div>
  );
}

function BillingToggle({
  value,
  onChange,
}: {
  value: Billing;
  onChange: (v: Billing) => void;
}) {
  return (
    <div
      className="mt-36 inline-flex items-center gap-4 p-4 rounded-full border border-white/10 bg-white/[0.04]"
      role="radiogroup"
      aria-label="Billing period"
    >
      {(["monthly", "annual"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "h-34 px-18 rounded-full text-[13.5px] font-medium transition-colors duration-140 capitalize",
            value === option
              ? "bg-white text-kiln-obsidian"
              : "text-white/55 hover:text-white/85",
          )}
        >
          {option}
          {option === "annual" && (
            <span
              className={cn(
                "ml-8 text-[11.5px]",
                value === option ? "text-kiln-iris-600" : "text-kiln-glow-500",
              )}
            >
              2 months free
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const isContact = plan.monthly === null;
  const shown =
    billing === "annual" ? monthlyEquivalent(plan) : plan.monthly;
  const saving = annualSaving(plan);

  return (
    <article
      className={cn(
        "flex flex-col rounded-16 border p-24",
        plan.highlighted
          ? "border-kiln-iris-400/45 bg-kiln-iris-500/[0.08]"
          : "border-white/8 bg-white/[0.025]",
      )}
    >
      <div className="flex items-baseline justify-between gap-8">
        <h2 className="text-[18px] font-medium text-white">{plan.name}</h2>
        {plan.highlighted && (
          <span className="text-[11px] uppercase tracking-[0.08em] text-kiln-iris-200">
            Most picked
          </span>
        )}
      </div>
      <p className="mt-6 text-[13px] text-white/45 min-h-[36px]">{plan.audience}</p>

      <p className="mt-18 text-[34px] font-semibold tracking-[-0.025em] text-white">
        {isContact ? (
          <span className="text-[24px]">Custom</span>
        ) : shown === 0 ? (
          "Free"
        ) : (
          <>
            €{shown}
            <span className="text-[14px] font-normal text-white/40"> /month</span>
          </>
        )}
      </p>
      <p className="mt-4 text-[12px] text-white/35 min-h-[18px]">
        {billing === "annual" && saving > 0
          ? `Billed annually · save ${saving}%`
          : isContact
            ? "Annual agreement"
            : ""}
      </p>

      <Link
        href={isContact ? brand.urls.sales : "/create"}
        className={cn(
          "mt-20 inline-flex items-center justify-center h-42 rounded-full text-[14px] font-medium transition-colors duration-140",
          plan.highlighted
            ? "bg-kiln-iris-500 text-white hover:bg-kiln-iris-400"
            : "border border-white/14 text-white/80 hover:text-white hover:border-white/28",
        )}
      >
        {plan.cta}
      </Link>

      <ul className="mt-24 space-y-10">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-9">
            <Check className="w-14 h-14 mt-3 shrink-0 text-white/35" aria-hidden />
            <span className="text-[13.5px] leading-[1.5] text-white/60">{f}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Faq() {
  const items = [
    {
      q: "What exactly counts as a build?",
      a: "One generation pass that creates or rebuilds an app — either from a description or from a URL. Follow-up edits in chat are metered separately, with a much higher allowance.",
    },
    {
      q: "Do I own the code?",
      a: "Yes, entirely. Everything Kiln generates is yours, on every plan including the free one. Export it as a zip or push it to GitHub whenever you like.",
    },
    {
      q: "Can I use my own API keys?",
      a: "From Pro upwards. Your keys, your provider account, your rate limits — Kiln just orchestrates the calls.",
    },
    {
      q: "What happens when I hit my limit?",
      a: "Builds stop until the next monthly reset, and the studio tells you which limit you reached and when it resets. Nothing is deleted and your projects stay accessible.",
    },
    {
      q: "Can I self-host?",
      a: "On Enterprise. You run Kiln on your own infrastructure and connect your own model endpoints and sandbox provider.",
    },
  ];

  return (
    <section className="mx-auto max-w-[1160px] px-24 pb-96">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-white mb-28">
        Questions
      </h2>
      <dl className="grid gap-20 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.q}
            className="rounded-16 border border-white/8 bg-white/[0.025] p-20"
          >
            <dt className="text-[15px] font-medium text-white">{item.q}</dt>
            <dd className="mt-8 text-[13.5px] leading-[1.6] text-white/55">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
