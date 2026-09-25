/**
 * Kiln — brand definition.
 *
 * Single source of truth for product naming, voice and outbound links.
 * Anything user-visible that says "Kiln" should read it from here so the
 * product can be white-labelled by changing one file.
 */

export const brand = {
  /** Short product name, used in the wordmark and in running copy. */
  name: 'Kiln',
  /** Full name, used in legal copy, page titles and metadata. */
  legalName: 'Kiln Studio',
  /** One-liner used as the HTML title suffix and in share cards. */
  tagline: 'Describe it. Ship it.',
  /** The positioning sentence — what we sell, in one breath. */
  promise:
    'The AI product studio. Turn a sentence or an existing site into a running React app you can edit, preview and export.',
  /** Longer description for meta tags and the app store style blurbs. */
  description:
    'Kiln turns a description into a working React application. Plan it with an AI blueprint, build it in a live sandbox, refine it in chat, and export production-ready code. Or point Kiln at any URL and rebuild it as clean, componentised React.',

  /** How the product talks. Referenced by the AI system prompts. */
  voice: {
    principles: [
      'Direct — say the thing, skip the throat-clearing.',
      'Confident, never boastful. Show the work instead of adjectives.',
      'Concrete nouns over abstract ones: "a running app", not "a solution".',
      'Respect the reader’s time. Short sentences beat clever ones.',
    ],
    /** Words we avoid because every AI product uses them. */
    avoid: ['revolutionary', 'game-changing', 'unleash', 'supercharge', 'seamlessly', 'magic'],
  },

  domain: 'kiln.studio',
  urls: {
    site: 'https://kiln.studio',
    app: 'https://app.kiln.studio',
    docs: '/docs',
    pricing: '/pricing',
    terms: '/legal/terms',
    privacy: '/legal/privacy',
    contact: 'mailto:hello@kiln.studio',
    sales: 'mailto:sales@kiln.studio',
    security: 'mailto:security@kiln.studio',
  },

  /** Social / OG defaults. */
  social: {
    ogImage: '/og.png',
    twitter: '@kilnstudio',
  },

  company: {
    name: 'Kiln Studio',
    year: 2026,
  },
} as const;

export type Brand = typeof brand;

/** Page title helper: `pageTitle("Pricing")` -> `"Pricing — Kiln"`. */
export function pageTitle(page?: string): string {
  return page ? `${page} — ${brand.name}` : `${brand.name} — ${brand.tagline}`;
}

export default brand;
