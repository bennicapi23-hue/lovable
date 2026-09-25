/**
 * Commercial plans.
 *
 * The unit of value is a **build** — one generation pass that produces or
 * changes an app. Builds are what actually cost money (model tokens plus
 * sandbox minutes), so metering them keeps pricing honest: a heavy user pays
 * more than a light one, and nobody pays per seat for someone who logs in
 * twice a month.
 *
 * Prices are in whole currency units (EUR). `null` means "talk to us".
 */

export type PlanId = 'free' | 'pro' | 'team' | 'enterprise';

export interface PlanLimits {
  /** Greenfield builds + rebuilds per calendar month. */
  buildsPerMonth: number;
  /** Follow-up edits per month. Cheaper than builds, so a higher ceiling. */
  editsPerMonth: number;
  /** Concurrent live sandboxes. */
  concurrentSandboxes: number;
  /** Minutes a sandbox stays warm before it is reclaimed. */
  sandboxMinutes: number;
  /** Seats included in the base price. */
  seats: number;
  /** Projects retained in history. */
  projectHistory: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Who this is for, in one line. */
  audience: string;
  /** Monthly price per account, in EUR. null = contact sales. */
  monthly: number | null;
  /** Annual price per account, in EUR. Two months free. */
  annual: number | null;
  limits: PlanLimits;
  /** Bullets, in the order they should be read. */
  features: string[];
  /** Capabilities gated by this plan, checked by lib/billing/entitlements. */
  entitlements: string[];
  /** Exactly one plan is the default recommendation. */
  highlighted?: boolean;
  cta: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Starter',
    audience: 'Trying Kiln out on a real idea',
    monthly: 0,
    annual: 0,
    limits: {
      buildsPerMonth: 10,
      editsPerMonth: 100,
      concurrentSandboxes: 1,
      sandboxMinutes: 15,
      seats: 1,
      projectHistory: 3,
    },
    features: [
      '10 builds a month',
      'Every model we support',
      'Live preview sandbox',
      'Export the full source at any time',
      'Community support',
    ],
    entitlements: ['build', 'edit', 'export', 'clone'],
    cta: 'Start building',
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'Shipping side projects and client work',
    monthly: 29,
    annual: 290,
    limits: {
      buildsPerMonth: 200,
      editsPerMonth: 2000,
      concurrentSandboxes: 3,
      sandboxMinutes: 45,
      seats: 1,
      projectHistory: 100,
    },
    features: [
      '200 builds a month',
      '3 sandboxes at once, 45-minute sessions',
      'Bring your own model keys',
      'Private projects and version history',
      'GitHub export',
      'Email support',
    ],
    entitlements: [
      'build',
      'edit',
      'export',
      'clone',
      'byok',
      'private-projects',
      'github-export',
      'version-history',
    ],
    highlighted: true,
    cta: 'Go Pro',
  },
  {
    id: 'team',
    name: 'Team',
    audience: 'A product team building internal tools',
    monthly: 99,
    annual: 990,
    limits: {
      buildsPerMonth: 1000,
      editsPerMonth: 10000,
      concurrentSandboxes: 10,
      sandboxMinutes: 60,
      seats: 5,
      projectHistory: 1000,
    },
    features: [
      '1,000 builds a month',
      '5 seats, shared workspace',
      'Shared component and design presets',
      'Role-based access',
      'Audit log',
      'Priority support',
    ],
    entitlements: [
      'build',
      'edit',
      'export',
      'clone',
      'byok',
      'private-projects',
      'github-export',
      'version-history',
      'shared-workspace',
      'rbac',
      'audit-log',
      'design-presets',
    ],
    cta: 'Start a team',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'Regulated, self-hosted or very large',
    monthly: null,
    annual: null,
    limits: {
      buildsPerMonth: Number.POSITIVE_INFINITY,
      editsPerMonth: Number.POSITIVE_INFINITY,
      concurrentSandboxes: 50,
      sandboxMinutes: 120,
      seats: 50,
      projectHistory: Number.POSITIVE_INFINITY,
    },
    features: [
      'Unlimited builds',
      'Self-hosted or private cloud',
      'SSO and SCIM',
      'Custom model endpoints',
      'DPA, security review, SLA',
      'Named support engineer',
    ],
    entitlements: [
      'build',
      'edit',
      'export',
      'clone',
      'byok',
      'private-projects',
      'github-export',
      'version-history',
      'shared-workspace',
      'rbac',
      'audit-log',
      'design-presets',
      'sso',
      'self-host',
      'custom-endpoints',
    ],
    cta: 'Talk to us',
  },
];

export const DEFAULT_PLAN_ID: PlanId = 'free';

export function getPlan(id: string | undefined | null): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Monthly-equivalent price when billed annually, for the pricing toggle. */
export function monthlyEquivalent(plan: Plan): number | null {
  if (plan.annual === null) return null;
  return Math.round((plan.annual / 12) * 100) / 100;
}

/** What the annual option saves, as a percentage. 0 when there is nothing to save. */
export function annualSaving(plan: Plan): number {
  if (!plan.monthly || !plan.annual) return 0;
  const full = plan.monthly * 12;
  if (full <= 0) return 0;
  return Math.round(((full - plan.annual) / full) * 100);
}

export function formatLimit(value: number): string {
  if (!Number.isFinite(value)) return 'Unlimited';
  return value.toLocaleString('en-GB');
}
