import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  Code2,
  Download,
  Eye,
  GitBranch,
  Globe,
  ListChecks,
  MessageSquare,
  Wand2,
  Zap,
} from "lucide-react";
import AppComposer from "@/components/kiln/AppComposer";
import SiteHeader from "@/components/marketing/SiteHeader";
import SiteFooter from "@/components/marketing/SiteFooter";
import KilnMark from "@/components/brand/KilnMark";
import { brand } from "@/config/brand.config";
import { PLANS } from "@/config/plans.config";

export const metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.description,
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-kiln-obsidian text-kiln-studio-text antialiased">
      <SiteHeader />
      <Hero />
      <Proof />
      <HowItWorks />
      <Capabilities />
      <CloneSection />
      <PricingTeaser />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------------- hero -- */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-140 pb-96">
      {/* Ambient light. Decorative only. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-[36%] left-1/2 -translate-x-1/2 w-[1000px] h-[760px] rounded-full opacity-[0.18] blur-[150px] bg-[radial-gradient(circle,#6244f5_0%,transparent_65%)]" />
        <div className="absolute top-[8%] -right-[12%] w-[560px] h-[560px] rounded-full opacity-[0.07] blur-[130px] bg-[radial-gradient(circle,#f2b441_0%,transparent_65%)]" />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage:
              "radial-gradient(ellipse 80% 55% at 50% 30%, black 20%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 55% at 50% 30%, black 20%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1160px] px-24">
        <div className="max-w-[760px]">
          <span className="inline-flex items-center gap-8 h-30 pl-8 pr-14 rounded-full border border-white/10 bg-white/[0.04] text-[12.5px] text-white/60">
            <KilnMark className="w-16 h-16" variant="firing" />
            Plan first, then build
          </span>

          <h1 className="mt-24 text-[clamp(42px,7.2vw,76px)] leading-[1.02] font-semibold tracking-[-0.035em] text-white">
            Describe it.
            <br />
            <span className="bg-[linear-gradient(100deg,#ffffff_0%,#c6bafb_46%,#f5c164_100%)] bg-clip-text text-transparent">
              Ship it.
            </span>
          </h1>

          <p className="mt-24 text-[18px] leading-[1.6] text-white/60 max-w-[56ch]">
            Kiln turns a sentence into a running React app. It writes a plan
            first — screens, data, design direction — you approve it, and then
            it builds in a live sandbox you can watch, edit and export.
          </p>
        </div>

        <div className="mt-40 max-w-[760px]">
          <AppComposer defaultMode="build" size="hero" />
        </div>

        <p className="mt-20 text-[13px] text-white/35">
          No credit card. {PLANS[0].limits.buildsPerMonth} builds a month on the
          free plan.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- proof -- */

function Proof() {
  const stats = [
    { value: "< 60s", label: "From description to a running preview" },
    { value: "100%", label: "Of the source is yours to export" },
    { value: "4", label: "Model providers, swappable per build" },
  ];

  return (
    <section className="border-y border-white/8 bg-white/[0.015]">
      <div className="mx-auto max-w-[1160px] px-24 py-40 grid gap-32 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[28px] font-semibold tracking-[-0.02em] text-white">
              {s.value}
            </p>
            <p className="mt-4 text-[13.5px] text-white/45 max-w-[28ch]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- how it works -- */

function HowItWorks() {
  const steps = [
    {
      icon: MessageSquare,
      title: "Describe the app",
      body: "Plain language. “A CRM for a plumbing business with customers, jobs and invoices.” Pick an archetype if you want a stronger starting point.",
    },
    {
      icon: ListChecks,
      title: "Approve the plan",
      body: "Kiln returns screens, routes, a data model and a visual direction before it writes a line of code. Change what is wrong — it is one click, not a rebuild.",
    },
    {
      icon: Eye,
      title: "Watch it build",
      body: "Files stream into a live sandbox. Packages install themselves. The preview is running by the time the last component lands.",
    },
  ];

  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="A plan you can correct beats a guess you have to undo"
      lead="Most AI builders start typing code immediately and you find out what they misunderstood at the end. Kiln makes the structure visible while it is still cheap to change."
    >
      <ol className="grid gap-20 md:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="relative rounded-16 border border-white/8 bg-white/[0.025] p-24"
          >
            <span className="absolute top-24 right-24 text-[13px] font-mono text-white/20">
              0{i + 1}
            </span>
            <s.icon className="w-22 h-22 text-kiln-iris-300" aria-hidden />
            <h3 className="mt-16 text-[17px] font-medium text-white">{s.title}</h3>
            <p className="mt-10 text-[14px] leading-[1.6] text-white/55">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* -------------------------------------------------------- capabilities -- */

function Capabilities() {
  const items = [
    {
      icon: Wand2,
      title: "Build from a description",
      body: "Ten app archetypes carry the assumptions — a dashboard gets KPI tiles and a real chart, a storefront gets a cart that actually adds up.",
    },
    {
      icon: Code2,
      title: "Real React, not a black box",
      body: "Function components, hooks, Tailwind. Readable files you would be willing to maintain, in a structure you can predict.",
    },
    {
      icon: MessageSquare,
      title: "Edit by conversation",
      body: "Ask for a change and Kiln finds the file that owns it. Targeted edits, so a copy tweak does not redesign your header.",
    },
    {
      icon: Zap,
      title: "Live sandbox",
      body: "Every build runs. Packages install on demand, the dev server restarts itself, and errors come back into the chat.",
    },
    {
      icon: Download,
      title: "Export everything",
      body: "Download the project as a zip or push it to GitHub. No runtime lock-in and no proprietary format.",
    },
    {
      icon: Boxes,
      title: "Your models, your keys",
      body: "OpenAI, Anthropic, Google and Groq, chosen per build. Bring your own keys, or route everything through a gateway.",
    },
  ];

  return (
    <Section
      id="capabilities"
      eyebrow="Capabilities"
      title="Everything between the idea and the repository"
    >
      <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.title}
            className="group rounded-16 border border-white/8 bg-white/[0.025] p-24 transition-colors duration-240 hover:border-white/16 hover:bg-white/[0.04]"
          >
            <item.icon
              className="w-20 h-20 text-white/45 transition-colors duration-240 group-hover:text-kiln-iris-300"
              aria-hidden
            />
            <h3 className="mt-16 text-[16px] font-medium text-white">{item.title}</h3>
            <p className="mt-8 text-[13.5px] leading-[1.6] text-white/50">{item.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- clone -- */

function CloneSection() {
  const points = [
    "Componentised React, not a flattened screenshot",
    "Structure, copy and layout carried across",
    "Or keep only the brand and build something new with it",
  ];

  return (
    <Section eyebrow="Rebuild" title="Point it at a site you already have">
      <div className="grid gap-40 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-[15.5px] leading-[1.65] text-white/60">
            Give Kiln a URL and it reads the page, then rebuilds it as clean
            React components you can edit. Useful for lifting a legacy marketing
            site into a modern stack, or for starting from a design you already
            like instead of a blank page.
          </p>
          <ul className="mt-24 space-y-12">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-10">
                <Check className="w-16 h-16 mt-3 shrink-0 text-kiln-success" aria-hidden />
                <span className="text-[14px] text-white/70">{p}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/generation"
            className="mt-28 inline-flex items-center gap-8 text-[14.5px] text-kiln-iris-300 hover:text-kiln-iris-200 transition-colors"
          >
            Rebuild a site
            <ArrowRight className="w-15 h-15" aria-hidden />
          </Link>
        </div>

        {/* A small, honest illustration of the transform. */}
        <div className="rounded-16 border border-white/8 bg-white/[0.02] p-20">
          <div className="flex items-center gap-10 text-[12.5px] text-white/40">
            <Globe className="w-14 h-14" aria-hidden />
            example.com
          </div>
          <div className="mt-16 grid grid-cols-[1fr_auto_1fr] items-center gap-14">
            <div className="space-y-6" aria-hidden>
              <div className="h-8 rounded-4 bg-white/10" />
              <div className="h-24 rounded-6 bg-white/[0.07]" />
              <div className="h-8 w-2/3 rounded-4 bg-white/10" />
              <div className="h-8 w-1/2 rounded-4 bg-white/[0.07]" />
            </div>
            <ArrowRight className="w-16 h-16 text-white/25" aria-hidden />
            <div className="space-y-6 font-mono text-[10.5px] text-white/45" aria-hidden>
              <div className="rounded-4 bg-kiln-iris-500/15 px-6 py-3">Header.jsx</div>
              <div className="rounded-4 bg-kiln-iris-500/15 px-6 py-3">Hero.jsx</div>
              <div className="rounded-4 bg-kiln-iris-500/15 px-6 py-3">Features.jsx</div>
              <div className="rounded-4 bg-kiln-iris-500/15 px-6 py-3">Footer.jsx</div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- pricing -- */

function PricingTeaser() {
  return (
    <Section
      eyebrow="Pricing"
      title="Pay for builds, not seats"
      lead="A build is one generation pass. That is what costs us money, so that is what we meter."
    >
      <div className="grid gap-16 md:grid-cols-3">
        {PLANS.filter((p) => p.id !== "enterprise").map((plan) => (
          <article
            key={plan.id}
            className={`rounded-16 border p-24 ${
              plan.highlighted
                ? "border-kiln-iris-400/45 bg-kiln-iris-500/[0.08]"
                : "border-white/8 bg-white/[0.025]"
            }`}
          >
            <div className="flex items-baseline justify-between gap-8">
              <h3 className="text-[17px] font-medium text-white">{plan.name}</h3>
              {plan.highlighted && (
                <span className="text-[11px] uppercase tracking-[0.08em] text-kiln-iris-200">
                  Most picked
                </span>
              )}
            </div>
            <p className="mt-6 text-[13px] text-white/45">{plan.audience}</p>
            <p className="mt-18 text-[32px] font-semibold tracking-[-0.02em] text-white">
              {plan.monthly === 0 ? "Free" : `€${plan.monthly}`}
              {plan.monthly ? (
                <span className="text-[14px] font-normal text-white/40"> /month</span>
              ) : null}
            </p>
            <ul className="mt-20 space-y-9">
              {plan.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-9">
                  <Check className="w-14 h-14 mt-3 shrink-0 text-white/35" aria-hidden />
                  <span className="text-[13.5px] text-white/60">{f}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <Link
        href="/pricing"
        className="mt-28 inline-flex items-center gap-8 text-[14.5px] text-white/60 hover:text-white transition-colors"
      >
        Compare every plan
        <ArrowRight className="w-15 h-15" aria-hidden />
      </Link>
    </Section>
  );
}

/* ----------------------------------------------------------- final cta -- */

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/8">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute bottom-[-60%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-[0.16] blur-[140px] bg-[radial-gradient(circle,#6244f5_0%,transparent_65%)]" />
      </div>

      <div className="relative mx-auto max-w-[1160px] px-24 py-96 text-center">
        <KilnMark className="w-44 h-44 mx-auto text-white" variant="firing" />
        <h2 className="mt-24 text-[clamp(30px,4.6vw,46px)] leading-[1.1] font-semibold tracking-[-0.03em] text-white">
          What would you build if it took a minute?
        </h2>
        <p className="mt-16 text-[16px] text-white/55 max-w-[46ch] mx-auto">
          Start with a sentence. Keep the code either way.
        </p>
        <div className="mt-32 flex flex-wrap items-center justify-center gap-12">
          <Link
            href="/create"
            className="inline-flex items-center gap-10 h-48 px-26 rounded-full bg-white text-kiln-obsidian text-[15px] font-medium hover:bg-white/90 transition-colors"
          >
            Start building
            <ArrowRight className="w-16 h-16" aria-hidden />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-8 h-48 px-22 rounded-full border border-white/14 text-[15px] text-white/75 hover:text-white hover:border-white/28 transition-colors"
          >
            <GitBranch className="w-16 h-16" aria-hidden />
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- shared -- */

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1160px] px-24 py-88 scroll-mt-80">
      <p className="text-[12px] uppercase tracking-[0.1em] text-kiln-iris-300/80">
        {eyebrow}
      </p>
      <h2 className="mt-12 text-[clamp(26px,3.6vw,38px)] leading-[1.15] font-semibold tracking-[-0.025em] text-white max-w-[24ch]">
        {title}
      </h2>
      {lead && (
        <p className="mt-16 text-[15.5px] leading-[1.6] text-white/50 max-w-[62ch]">
          {lead}
        </p>
      )}
      <div className="mt-40">{children}</div>
    </section>
  );
}
