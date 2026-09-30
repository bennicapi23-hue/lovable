"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PLANS } from "@/config/plans.config";
import { cn } from "@/utils/cn";

/**
 * Upgrade and manage-subscription buttons.
 *
 * Both hand off to Stripe-hosted pages rather than collecting card details
 * here: card data never touches this application, which keeps PCI scope to
 * the minimum.
 */
export default function BillingActions({
  planId,
  billingEnabled,
  purchasable,
}: {
  planId: string;
  billingEnabled: boolean;
  purchasable: string[];
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function go(path: string, body?: unknown, label?: string) {
    setBusy(label ?? path);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        toast.error(data.error || "Could not reach the payment provider.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Could not reach the payment provider.");
    } finally {
      setBusy(null);
    }
  }

  if (!billingEnabled) {
    return (
      <Link
        href="/pricing"
        className="inline-flex items-center h-38 px-18 rounded-full border border-white/12 text-[14px] text-white/70 hover:text-white hover:border-white/25 transition-colors"
      >
        See plans
      </Link>
    );
  }

  const isPaid = planId !== "free";
  const upgrades = PLANS.filter((p) => purchasable.includes(p.id) && p.id !== planId);

  return (
    <div className="flex flex-wrap items-center gap-10">
      {upgrades.map((plan) => (
        <button
          key={plan.id}
          type="button"
          disabled={busy !== null}
          onClick={() => go("/api/billing/checkout", { plan: plan.id, period: "monthly" }, plan.id)}
          className={cn(
            "inline-flex items-center gap-8 h-38 px-18 rounded-full text-[14px] font-medium transition-colors",
            plan.highlighted
              ? "bg-kiln-iris-500 text-white hover:bg-kiln-iris-400"
              : "border border-white/12 text-white/75 hover:text-white hover:border-white/25",
            busy && "opacity-60 cursor-wait",
          )}
        >
          {busy === plan.id && <Loader2 className="w-14 h-14 animate-spin" aria-hidden />}
          Switch to {plan.name}
        </button>
      ))}

      {isPaid && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => go("/api/billing/portal", {}, "portal")}
          className="inline-flex items-center gap-8 h-38 px-18 rounded-full border border-white/12 text-[14px] text-white/70 hover:text-white hover:border-white/25 transition-colors disabled:opacity-60"
        >
          {busy === "portal" && <Loader2 className="w-14 h-14 animate-spin" aria-hidden />}
          Manage subscription
        </button>
      )}
    </div>
  );
}
