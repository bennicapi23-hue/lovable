<div align="center">

# Kiln

**Describe it. Ship it.**

Turn a sentence into a running React app. Plan it, watch it build in a live
sandbox, refine it in chat, export the source.

[Quick start](#quick-start) · [How it works](#how-it-works) · [Architecture](#architecture) · [Deployment](#deployment) · [Licence](#licence)

</div>

---

## What this is

Kiln takes a description — *"a CRM for a plumbing business with customers, jobs
and invoices"* — and produces a working React + Vite + Tailwind application
running in a sandbox you can preview and edit.

It does that in two passes, which is the part that matters:

1. **Plan.** Kiln writes a blueprint first: screens, routes, a data model, a
   visual direction. You see it and correct it before a line of code exists.
2. **Build.** The approved blueprint drives generation, so the model
   transcribes a decided structure instead of improvising one mid-stream.

Planning first is not ceremony. Without it, a model invents structure as it
goes, forgets a page it referenced three files ago, and imports components it
never wrote. Fixing that after generation costs a whole rebuild. Fixing it in
the plan costs one click.

Kiln can also point at an existing URL and rebuild that page as componentised
React — useful for lifting a legacy site into a modern stack.

## Quick start

```bash
git clone <your-fork> kiln && cd kiln
pnpm install
cp .env.example .env.local        # then fill it in, see below
openssl rand -base64 32           # put this in AUTH_SECRET
pnpm db:migrate                   # creates ./kiln.db
pnpm check:env                    # tells you exactly what is still missing
pnpm dev
```

Sign up at <http://localhost:3000/sign-in> — the first account is yours.

Open <http://localhost:3000>.

### Configuration

Kiln needs two things to build an app, and one optional extra.

| Capability | Variable | Required |
|---|---|---|
| **Language model** | `AI_GATEWAY_API_KEY`, or any of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` | Yes — at least one |
| **Sandbox** | `VERCEL_OIDC_TOKEN` (or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`), or `E2B_API_KEY` with `SANDBOX_PROVIDER=e2b` | Yes |
| **Sessions** | `AUTH_SECRET` — `openssl rand -base64 32` | Yes |
| **Database** | `DATABASE_URL` — defaults to `file:./kiln.db` | Defaulted |
| **URL rebuild** | `FIRECRAWL_API_KEY` | No — building from a description works without it |
| **Faster edits** | `MORPH_API_KEY` | No |
| **OAuth sign-in** | `AUTH_GITHUB_ID`/`SECRET`, `AUTH_GOOGLE_ID`/`SECRET` | No — email and password works alone |

You do not have to hold a key for the model named in `config/app.config.ts`.
If its provider is not configured, Kiln falls back to a model whose provider
is, and logs the substitution, rather than failing on a choice you never made.

`pnpm check:env` reports what is configured, what is missing, and the exact fix
for each gap. `GET /api/status` returns the same information as JSON, without
echoing any key material, so it is safe to expose to an uptime check.

## How it works

```
  description ──▶ /api/generate-blueprint ──▶ blueprint ──▶ you approve it
                         (plan)                                   │
                                                                  ▼
  URL ────────▶ /api/scrape-url-enhanced ─────────▶ /api/generate-ai-code-stream
                    (Firecrawl)                              (generate)
                                                                  │
                                                                  ▼
                                    /api/apply-ai-code-stream ──▶ sandbox
                                       (write + install)       (live preview)
```

**Build from a description** — `/create` collects the description, calls the
planner, renders the blueprint for approval, then hands it to the studio via
`sessionStorage`. The studio skips scraping entirely and builds from the plan.

**Rebuild from a URL** — `/generation` scrapes the page with Firecrawl and asks
the model to recreate it as components.

**Editing** — follow-up chat messages are classified by
`lib/edit-intent-analyzer.ts`, which picks the smallest set of files that could
satisfy the request. That is why asking to change a headline does not redesign
your header.

## Architecture

```
app/
  page.tsx                  Marketing landing
  sign-in/                  Sign in and registration
  projects/                 Saved projects for the signed-in account
  create/                   Describe → plan → approve → build
  generation/               The studio: preview, files, chat
  pricing/  legal/          Commercial surface
  api/
    generate-blueprint/     Plans an app before any code is written
    generate-ai-code-stream/ Streams generated files
    apply-ai-code-stream/   Writes files into the sandbox, installs packages
    scrape-*/               Firecrawl-backed extraction (SSRF-guarded)
    status/                 Deployment readiness
lib/
  app-builder/              Archetypes, blueprint schema, build prompts
  ai/provider-manager.ts    Model → provider resolution and fallback
  sandbox/                  Provider abstraction (Vercel, E2B)
  auth/                     Auth.js config and scrypt password hashing
  db/                       Drizzle schema, migrations, project queries
  billing/entitlements.ts   Plan limits and metering (database only)
  billing/session.ts        Request → account (the only Auth.js dependency)
  security/                 SSRF guard, rate limiting
  env.ts                    Configuration validation
config/
  brand.config.ts           Naming, voice, links — white-label from one file
  plans.config.ts           Commercial plans and limits
  app.config.ts             Runtime behaviour
```

### Extending it

**Add an app archetype** — append to `lib/app-builder/archetypes.ts`. An
archetype supplies the structural prior (expected screens, core entities) and
the quality bar that makes that kind of app convincing. It shows up in the
composer automatically.

**White-label it** — edit `config/brand.config.ts` for naming and links, and
the token block in `styles/design-system/kiln-tokens.css` for colour. The
`heat-*` ramp in `colors.css` is the legacy primary and is aliased to the brand
colour, so changing it re-skins components that predate the token layer.

**Connect real billing** — plans are already enforced against the signed-in
account, with counters in the database. What is missing is payment: call
`setPlan(userId, planId)` from your payment provider's webhook and the rest
already works.

## Testing

```bash
pnpm test        # unit tests: url guard, blueprint, billing, rate limit, env
pnpm typecheck   # tsc --noEmit
pnpm lint
pnpm verify      # all three
```

Tests run on Node's built-in runner with no test framework dependency, using
native TypeScript type-stripping. `tests/alias-loader.mjs` teaches Node the
`@/` path alias and extensionless imports so the tests exercise the real
modules rather than copies.

## Deployment

Kiln is a standard Next.js 15 app and deploys anywhere Next does.

```bash
pnpm build && pnpm start
```

Before promoting a deployment, run `pnpm check:env` against its environment, or
poll `GET /api/status` — it returns `503` until the deployment can actually
build an app.

### Known limitation: one concurrent build per instance

Accounts, projects and usage are per-user and persisted. **Sandbox state is
not**: it still lives in Node globals (`global.activeSandbox`,
`global.conversationState`), inherited from upstream, so one process serves
one concurrent build even though many users can now sign in.

A keyed `SandboxManager` already exists in `lib/sandbox/sandbox-manager.ts`;
migrating the API routes onto it, keyed by project, is the remaining work for
multi-tenant hosting. Until then, run one builder instance per concurrent
user, or put a queue in front.

Rate limiting has the same shape — `lib/security/rate-limit.ts` counts
per-instance and says so in its `X-RateLimit-Scope` header. Behind more than
one instance, move the counters to a shared store.

## Commercial use

The source is MIT-licensed: use it, modify it, sell what you build with it.
Plans, limits and entitlements are defined in `config/plans.config.ts` and
enforced by `lib/billing/entitlements.ts`.

## Licence

MIT — see [`LICENSE`](./LICENSE).

Kiln is a derivative of [open-lovable](https://github.com/firecrawl/open-lovable)
by Firecrawl, used under the MIT Licence, with the original copyright notice
retained. See [`NOTICE`](./NOTICE) for full attribution and a summary of what
changed. Kiln is not affiliated with or endorsed by Firecrawl.
