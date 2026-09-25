import { z } from 'zod';
import { getArchetype, inferArchetype, type AppArchetype } from './archetypes';

/**
 * The blueprint is the contract between "what the user asked for" and
 * "what the code generator builds".
 *
 * Planning before generating matters more than it looks: without it the model
 * invents a structure mid-stream, forgets a page it referenced, and imports
 * components it never wrote. A blueprint fixes the file list, the routes and
 * the data shape up front, so generation becomes transcription rather than
 * improvisation — and the user gets something to approve or correct before
 * any tokens are spent on code.
 */

export const blueprintSchema = z.object({
  name: z.string().describe('Product name. Short, specific, no generic "App" suffix.'),
  tagline: z.string().describe('One line describing what it does for whom.'),
  summary: z.string().describe('Two or three sentences on scope and behaviour.'),
  archetype: z.string().describe('Archetype id this app belongs to.'),
  audience: z.string().describe('Who uses this, in a few words.'),

  design: z.object({
    direction: z
      .string()
      .describe('The visual thesis in one sentence, e.g. "Editorial calm with a single hot accent".'),
    palette: z.object({
      primary: z.string().describe('Hex, e.g. #6244F5'),
      accent: z.string().describe('Hex'),
      background: z.string().describe('Hex'),
      surface: z.string().describe('Hex'),
      text: z.string().describe('Hex'),
    }),
    typography: z.object({
      display: z.string().describe('Font family for headings.'),
      body: z.string().describe('Font family for body copy.'),
    }),
    mood: z.array(z.string()).describe('Three to five adjectives.'),
    density: z.enum(['airy', 'balanced', 'dense']),
    radius: z.enum(['sharp', 'soft', 'round']),
    darkMode: z.boolean().describe('Whether the app is designed dark-first.'),
  }),

  pages: z
    .array(
      z.object({
        name: z.string(),
        route: z.string().describe('Path, e.g. "/" or "/projects/:id".'),
        purpose: z.string().describe('What the user accomplishes here.'),
        sections: z.array(z.string()).describe('Ordered blocks that make up the page.'),
      }),
    )
    .describe('Screens to build. Keep to the few that carry the product.'),

  components: z
    .array(
      z.object({
        name: z.string().describe('PascalCase component name.'),
        file: z.string().describe('Path under src/, e.g. "src/components/MetricTile.jsx".'),
        role: z.string().describe('What it renders and owns.'),
      }),
    )
    .describe('Component inventory. Every import in generated code must appear here.'),

  dataModel: z
    .array(
      z.object({
        entity: z.string().describe('PascalCase entity name.'),
        fields: z.array(
          z.object({
            name: z.string(),
            type: z.string().describe('string | number | boolean | date | enum | ref'),
            example: z.string().describe('A realistic example value.'),
          }),
        ),
      }),
    )
    .describe('Shapes the seed data will follow.'),

  features: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        priority: z.enum(['core', 'supporting', 'later']),
      }),
    )
    .describe('Behaviour, not decoration. Mark what is essential to a first build.'),

  packages: z.array(z.string()).describe('npm packages beyond react/react-dom/tailwind.'),
  notes: z.array(z.string()).describe('Decisions, trade-offs and anything deferred.'),
});

export type AppBlueprint = z.infer<typeof blueprintSchema>;

/** Model-facing instructions for the planning pass. */
export function buildPlannerPrompt(userPrompt: string, archetype?: AppArchetype): string {
  const archetypeBlock = archetype
    ? `
The request looks like a "${archetype.name}" — ${archetype.description}.
Unless the user says otherwise, assume:
- Screens: ${archetype.expectedPages.join(', ')}
- Domain objects: ${archetype.coreEntities.join(', ')}
- Useful packages: ${archetype.suggestedPackages.join(', ')}
- Default aesthetic: ${archetype.designHint}

An app of this kind is only convincing if:
${archetype.qualityBar.map((q) => `- ${q}`).join('\n')}
`
    : `
No archetype matched, so infer the structure from the request itself. Prefer
the smallest set of screens that makes the product usable.
`;

  return `You are a product architect. Turn the request below into a build plan
for a React + Vite + Tailwind single-page application.

REQUEST
"""
${userPrompt}
"""
${archetypeBlock}

RULES
1. Plan the app the user asked for. Do not substitute a different, easier app.
2. Prefer three to six pages. A focused app that works beats a broad one that does not.
3. Every component another component imports must be listed in "components".
   The file list you produce is the file list that gets written.
4. Seed data must look like it came from the real world: real-sounding names,
   plausible numbers, dates near today. Never "Item 1", "Lorem ipsum", "foo".
5. Pick a specific visual direction with a point of view. Avoid defaulting to
   generic indigo-on-white SaaS unless the request calls for it. Colours must
   be concrete hex values that pass WCAG AA for body text on their background.
6. "features" describes behaviour that must actually work, not adjectives.
7. Routes use a simple client-side router only if there is more than one page.

Return the plan as structured data.`;
}

/**
 * Normalises a model-produced blueprint so downstream code can rely on it:
 * trims, drops empties, enforces the archetype id, and guarantees the
 * invariants the generator assumes (at least one page, App.jsx present).
 */
export function normaliseBlueprint(
  raw: AppBlueprint,
  opts: { archetypeId?: string; fallbackName?: string } = {},
): AppBlueprint {
  const archetypeId =
    getArchetype(raw.archetype)?.id ??
    getArchetype(opts.archetypeId)?.id ??
    inferArchetype(raw.summary ?? '')?.id ??
    'landing-page';

  const pages = (raw.pages ?? [])
    .filter((p) => p?.name?.trim())
    .map((p) => ({
      ...p,
      name: p.name.trim(),
      route: p.route?.trim() || '/',
      sections: (p.sections ?? []).filter(Boolean),
    }));

  const components = (raw.components ?? [])
    .filter((c) => c?.name?.trim() && c?.file?.trim())
    .map((c) => ({ ...c, name: c.name.trim(), file: normaliseFilePath(c.file) }));

  // The generator always writes an entry component; make sure the plan says so
  // rather than letting the model omit it and then import it anyway.
  if (!components.some((c) => /(^|\/)App\.(jsx|tsx)$/.test(c.file))) {
    components.unshift({
      name: 'App',
      file: 'src/App.jsx',
      role: 'Application shell: routing, layout and page composition.',
    });
  }

  return {
    ...raw,
    name: raw.name?.trim() || opts.fallbackName || 'Untitled app',
    archetype: archetypeId,
    pages: pages.length ? pages : [{
      name: 'Home',
      route: '/',
      purpose: 'Primary screen.',
      sections: ['Header', 'Main content', 'Footer'],
    }],
    components,
    dataModel: (raw.dataModel ?? []).filter((d) => d?.entity?.trim()),
    features: (raw.features ?? []).filter((f) => f?.name?.trim()),
    packages: dedupe((raw.packages ?? []).map((p) => p.trim()).filter(Boolean)),
    notes: (raw.notes ?? []).filter(Boolean),
  };
}

function normaliseFilePath(file: string): string {
  const trimmed = file.trim().replace(/^\.?\//, '');
  return trimmed.startsWith('src/') ? trimmed : `src/${trimmed}`;
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Packages we never let a blueprint pull in, because the sandbox provides them. */
const PROVIDED_PACKAGES = new Set([
  'react',
  'react-dom',
  'tailwindcss',
  'vite',
  '@vitejs/plugin-react',
  'postcss',
  'autoprefixer',
]);

export function installablePackages(blueprint: AppBlueprint): string[] {
  return blueprint.packages.filter((p) => !PROVIDED_PACKAGES.has(p.toLowerCase()));
}
