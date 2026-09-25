import type { AppBlueprint } from './blueprint';
import { getArchetype } from './archetypes';

/**
 * Turns an approved blueprint into the generation prompt.
 *
 * This is deliberately different in kind from the website-cloning prompt.
 * Cloning has a ground truth to match, so the instructions are about
 * fidelity. Building from a description has no ground truth, so the
 * instructions are about *commitment*: pick real content, real data and a
 * real point of view, and make every screen in the plan actually exist.
 * Vagueness is the failure mode here, and these rules attack it directly.
 */
export function buildGreenfieldPrompt(
  blueprint: AppBlueprint,
  userPrompt: string,
  extraInstructions?: string,
): string {
  const archetype = getArchetype(blueprint.archetype);
  const d = blueprint.design;

  const pages = blueprint.pages
    .map(
      (p, i) =>
        `${i + 1}. ${p.name} (${p.route}) — ${p.purpose}\n   Sections: ${p.sections.join(' · ')}`,
    )
    .join('\n');

  const components = blueprint.components
    .map((c) => `- ${c.file} → ${c.name}: ${c.role}`)
    .join('\n');

  const dataModel = blueprint.dataModel
    .map(
      (e) =>
        `- ${e.entity} { ${e.fields
          .map((f) => `${f.name}: ${f.type} (e.g. ${f.example})`)
          .join(', ')} }`,
    )
    .join('\n');

  const coreFeatures = blueprint.features
    .filter((f) => f.priority === 'core')
    .map((f) => `- ${f.name}: ${f.description}`)
    .join('\n');

  const supporting = blueprint.features
    .filter((f) => f.priority === 'supporting')
    .map((f) => `- ${f.name}: ${f.description}`)
    .join('\n');

  const qualityBar = archetype
    ? archetype.qualityBar.map((q) => `- ${q}`).join('\n')
    : '- Every interactive element does something observable.';

  return `Build a new React application from the plan below. This is a fresh
build: there is no existing site to copy and no file to preserve.

WHAT THE USER ASKED FOR
"""
${userPrompt}
"""

PRODUCT
- Name: ${blueprint.name}
- Tagline: ${blueprint.tagline}
- For: ${blueprint.audience}
- Summary: ${blueprint.summary}

SCREENS TO BUILD
${pages}

FILES TO WRITE
${components}

Write every file in this list and no others. If a component imports something,
it must be in this list — no phantom imports.

DATA MODEL
${dataModel || '- No persistent entities; derive state from user interaction.'}

Put seed data in src/data/ as plain exported arrays matching these shapes.
Components read from there. Ten to twenty rows per collection: enough that
lists, filters and charts have something to show.

MUST WORK
${coreFeatures || '- The primary flow described above, end to end.'}

${supporting ? `SHOULD WORK\n${supporting}\n` : ''}
WHAT MAKES THIS CONVINCING
${qualityBar}

VISUAL DIRECTION
- Thesis: ${d.direction}
- Mood: ${d.mood.join(', ')}
- Palette: primary ${d.palette.primary}, accent ${d.palette.accent},
  background ${d.palette.background}, surface ${d.palette.surface}, text ${d.palette.text}
- Type: ${d.typography.display} for headings, ${d.typography.body} for body
- Density: ${d.density}. Corners: ${d.radius}. ${d.darkMode ? 'Dark-first.' : 'Light-first.'}

Apply the palette with Tailwind arbitrary values (bg-[${d.palette.primary}]) or
CSS variables declared in src/index.css. Use the exact hex values above — do
not substitute the nearest Tailwind default.

CONTENT RULES — THESE DECIDE WHETHER THE BUILD LOOKS REAL
- Write specific copy for this product. No "Lorem ipsum", no "Your text here",
  no "Feature One / Feature Two", no "Item 1".
- Names, companies, amounts and dates must be plausible and varied.
- Empty states say what the user should do next, not "No data".
- Numbers in charts and tiles must come from the seed data, so they agree with
  each other. A tile that says 1,284 and a chart that sums to 400 reads as broken.

TECHNICAL RULES
- React function components with hooks. No class components.
- Tailwind utility classes for layout and style. Custom CSS only in
  src/index.css, and only for fonts, keyframes or effects Tailwind cannot express.
- Use ONLY standard Tailwind classes (bg-white, text-gray-900, bg-blue-500) or
  arbitrary values. Never bg-background, text-foreground, bg-primary — those
  are design-system tokens that do not exist in this project.
${
  blueprint.pages.length > 1
    ? `- ${blueprint.pages.length} pages, so use react-router-dom with a BrowserRouter in App.jsx.`
    : '- Single page: no router. Navigation scrolls to sections.'
}
- Responsive from 375px up. The mobile layout must be deliberate, not a
  squeezed desktop one.
- Accessible: real button/a elements, labelled inputs, visible focus rings,
  alt text on images.
- Every file complete and runnable. No "...", no TODO, no truncation.

PACKAGES
${blueprint.packages.length ? blueprint.packages.map((p) => `- ${p}`).join('\n') : '- None beyond the defaults.'}
Import them where used; they are installed automatically.

${extraInstructions ? `ADDITIONAL INSTRUCTIONS FROM THE USER\n${extraInstructions}\n` : ''}
Start with src/index.css and src/App.jsx, then the pages, then the components
they depend on, then the seed data.`;
}

/**
 * System-prompt fragment appended when the generator is in create mode.
 * The base system prompt is written for editing and cloning; these lines
 * reverse the defaults that would otherwise hold a fresh build back.
 */
export const GREENFIELD_SYSTEM_RULES = `
CREATE MODE — BUILDING A NEW APPLICATION FROM A PLAN

This request is a fresh build, not an edit and not a clone. The rules that
normally limit how many files you touch do not apply: you are expected to
write the full file list from the plan in one pass.

1. Write every file the plan lists. A missing file is a broken build.
2. Do not ask clarifying questions. The plan is the decision. Where it is
   silent, choose the option a senior engineer would choose and note it.
3. Commit to specifics. Invented-but-plausible content beats placeholders
   every time.
4. Build the whole flow. A screen that looks right but does nothing when
   clicked is a failure, not a first draft.
5. Still no phantom imports: if you import it, you write it.
`;
