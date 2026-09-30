import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { resolveAccount } from "@/lib/billing/session";
import { usageSnapshot } from "@/lib/billing/entitlements";
import { isBillingConfigured, purchasablePlans } from "@/lib/billing/stripe";
import KilnLogo from "@/components/brand/KilnLogo";
import SignOutButton from "@/components/auth/SignOutButton";
import BillingActions from "@/components/auth/BillingActions";

export const metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/account");

  const account = await resolveAccount();
  if (!account) redirect("/sign-in?callbackUrl=/account");

  const snapshot = await usageSnapshot(account);
  const billingOn = isBillingConfigured();
  const buyable = purchasablePlans();

  return (
    <main className="min-h-screen bg-kiln-obsidian text-kiln-studio-text">
      <header className="border-b border-white/8">
        <div className="mx-auto max-w-[840px] px-24 h-64 flex items-center justify-between">
          <span className="text-white">
            <KilnLogo markClassName="w-22 h-22" variant="gradient" href="/projects" />
          </span>
          <div className="flex items-center gap-16">
            <Link href="/projects" className="text-[13.5px] text-white/50 hover:text-white transition-colors">
              Projects
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[840px] px-24 py-48">
        <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-white">Account</h1>
        <p className="mt-6 text-[14px] text-white/45">{session.user.email}</p>

        <section className="mt-32 rounded-16 border border-white/8 bg-white/[0.025] p-24">
          <div className="flex flex-wrap items-baseline justify-between gap-12">
            <h2 className="text-[18px] font-medium text-white">{snapshot.plan.name} plan</h2>
            <span className="text-[12.5px] text-white/35">
              Resets{" "}
              {new Date(snapshot.resetsAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <p className="mt-4 text-[13.5px] text-white/45">{snapshot.plan.audience}</p>

          <div className="mt-24 space-y-18">
            <Meter label="Builds" used={snapshot.builds.used} limit={snapshot.builds.limit} />
            <Meter label="Edits" used={snapshot.edits.used} limit={snapshot.edits.limit} />
          </div>

          <div className="mt-24 pt-20 border-t border-white/8">
            <BillingActions
              planId={snapshot.plan.id}
              billingEnabled={billingOn}
              purchasable={buyable}
            />
          </div>
        </section>

        {!billingOn && (
          <p className="mt-16 text-[12.5px] text-white/30">
            This deployment has no payment processor configured, so plans cannot
            be changed from here. See <code className="text-white/45">docs/ROADMAP.md</code>.
          </p>
        )}
      </div>
    </main>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const spent = !unlimited && used >= limit;

  return (
    <div>
      <div className="flex items-baseline justify-between text-[13.5px]">
        <span className="text-white/70">{label}</span>
        <span className={spent ? "text-kiln-danger" : "text-white/45"}>
          {used.toLocaleString("en-GB")}
          {unlimited ? " used" : ` of ${limit.toLocaleString("en-GB")}`}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-8 h-6 rounded-full bg-white/8 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-480 ${
              spent ? "bg-kiln-danger" : pct > 80 ? "bg-kiln-glow-500" : "bg-kiln-iris-500"
            }`}
            style={{ width: `${Math.max(pct, used > 0 ? 3 : 0)}%` }}
          />
        </div>
      )}
    </div>
  );
}
