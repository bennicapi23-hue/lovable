#!/usr/bin/env node
/**
 * Prints the cost per build each plan can absorb before it loses money.
 *
 * Run it after the first real builds, with the measured cost:
 *
 *   pnpm margin            # break-even per plan
 *   pnpm margin 0.12       # margin at 12 cents a build
 */
import { readFileSync } from 'node:fs';

// plans.config.ts is TypeScript; read the numbers rather than importing it,
// so this script needs no build step.
const source = readFileSync(new URL('../config/plans.config.ts', import.meta.url), 'utf8');

const plans = [...source.matchAll(
  /id:\s*'(\w+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?monthly:\s*(\d+|null)[\s\S]*?buildsPerMonth:\s*([\d_]+|Number\.POSITIVE_INFINITY)/g,
)].map(([, id, name, monthly, builds]) => ({
  id,
  name,
  monthly: monthly === 'null' ? null : Number(monthly),
  builds: builds.includes('INFINITY') ? Infinity : Number(builds.replace(/_/g, '')),
}));

const measured = process.argv[2] ? Number(process.argv[2]) : null;

console.log(
  measured === null
    ? '\nBreak-even cost per build:\n'
    : `\nMargin at €${measured.toFixed(3)} per build:\n`,
);

for (const plan of plans) {
  if (!plan.monthly || !Number.isFinite(plan.builds)) continue;

  const breakEven = plan.monthly / plan.builds;

  if (measured === null) {
    console.log(`  ${plan.name.padEnd(12)} €${plan.monthly}/mo · ${plan.builds} builds -> €${breakEven.toFixed(3)} per build`);
    continue;
  }

  const cost = plan.builds * measured;
  const margin = plan.monthly - cost;
  const pct = Math.round((margin / plan.monthly) * 100);
  const verdict = margin > 0 ? 'ok' : 'LOSS';

  console.log(
    `  ${plan.name.padEnd(12)} revenue €${String(plan.monthly).padEnd(4)} ` +
    `cost €${cost.toFixed(2).padEnd(7)} margin €${margin.toFixed(2).padEnd(8)} ${String(pct).padStart(4)}%  ${verdict}`,
  );
}
// A more expensive plan should absorb *more* cost per build, not less.
// When break-even falls as price rises, the cheaper plan subsidises the
// dearer one and the dearer one goes underwater first — the opposite of
// what its price implies.
const paid = plans.filter((p) => p.monthly && Number.isFinite(p.builds));
const inversions = [];
for (let i = 1; i < paid.length; i += 1) {
  const cheaper = paid[i - 1];
  const dearer = paid[i];
  if (dearer.monthly / dearer.builds < cheaper.monthly / cheaper.builds) {
    inversions.push([cheaper, dearer]);
  }
}

if (inversions.length) {
  console.log('\n  \u26a0  Pricing inversion\n');
  for (const [cheaper, dearer] of inversions) {
    console.log(
      `     ${dearer.name} breaks even at \u20ac${(dearer.monthly / dearer.builds).toFixed(3)} but ` +
      `${cheaper.name} at \u20ac${(cheaper.monthly / cheaper.builds).toFixed(3)}.`,
    );
    console.log(
      `     ${dearer.name} costs ${(dearer.monthly / cheaper.monthly).toFixed(1)}x more but includes ` +
      `${(dearer.builds / cheaper.builds).toFixed(1)}x the builds, so it goes underwater first.`,
    );
    console.log(
      `     Either raise its price, or cut its included builds to ` +
      `${Math.floor(dearer.monthly / (cheaper.monthly / cheaper.builds))}.\n`,
    );
  }
}

console.log('');
