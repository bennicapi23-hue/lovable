/**
 * App archetypes.
 *
 * A blank prompt box is intimidating and produces vague apps. Archetypes give
 * the planner a strong prior: what pages an app of this kind normally has,
 * which entities it revolves around, and what "done" looks like. The user
 * still describes their own app — the archetype only supplies the scaffolding
 * assumptions so the first build lands much closer to useful.
 */

export interface AppArchetype {
  id: string;
  /** Shown on the archetype chip. */
  name: string;
  /** One line, shown under the name. */
  description: string;
  /** Lucide icon name, resolved on the client. */
  icon: string;
  /** Prefilled into the composer when the chip is picked. */
  samplePrompt: string;
  /** Screens the planner should assume unless the user says otherwise. */
  expectedPages: string[];
  /** Domain objects this kind of app is built around. */
  coreEntities: string[];
  /** What separates a convincing build from a hollow one. */
  qualityBar: string[];
  /** npm packages that are usually worth pulling in. */
  suggestedPackages: string[];
  /** Default aesthetic, overridable by the user's own words. */
  designHint: string;
}

export const APP_ARCHETYPES: AppArchetype[] = [
  {
    id: 'saas-dashboard',
    name: 'SaaS dashboard',
    description: 'Metrics, charts and a data table behind a sidebar',
    icon: 'LayoutDashboard',
    samplePrompt:
      'A dashboard for a payments company showing revenue, churn and active customers, with a filterable transactions table',
    expectedPages: ['Overview', 'Detail/analytics view', 'Settings'],
    coreEntities: ['Metric', 'Record', 'User'],
    qualityBar: [
      'KPI tiles show a value, a label and a period-over-period delta',
      'At least one real chart driven by the seed data, not a static image',
      'The table sorts and filters, and has an empty state',
      'Sidebar marks the active route',
    ],
    suggestedPackages: ['recharts', 'lucide-react', 'date-fns'],
    designHint: 'Dense, calm, data-forward. Restrained colour; let the numbers carry the page.',
  },
  {
    id: 'landing-page',
    name: 'Landing page',
    description: 'Marketing site with hero, features and pricing',
    icon: 'Sparkles',
    samplePrompt:
      'A landing page for a habit-tracking app, with a hero, three feature blocks, testimonials and a pricing table',
    expectedPages: ['Home'],
    coreEntities: ['Feature', 'Plan', 'Testimonial'],
    qualityBar: [
      'A hero with a real headline and a primary call to action',
      'Feature section with specific copy, never lorem ipsum',
      'Pricing table with at least three tiers and a highlighted plan',
      'Footer with navigation and legal links',
    ],
    suggestedPackages: ['lucide-react', 'framer-motion'],
    designHint: 'Generous whitespace, confident type scale, one accent colour used sparingly.',
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Contacts, pipeline stages and deal tracking',
    icon: 'Users',
    samplePrompt:
      'A lightweight CRM with a contact list, a drag-free kanban pipeline and a detail panel for each deal',
    expectedPages: ['Contacts', 'Pipeline', 'Contact detail'],
    coreEntities: ['Contact', 'Company', 'Deal', 'Activity'],
    qualityBar: [
      'Contacts list supports search and shows avatar, company and status',
      'Pipeline groups deals by stage with per-stage totals',
      'Selecting a record opens a detail view with activity history',
    ],
    suggestedPackages: ['lucide-react', 'date-fns'],
    designHint: 'Utilitarian and quick to scan. Status communicated by colour chips.',
  },
  {
    id: 'ecommerce',
    name: 'Storefront',
    description: 'Product grid, detail page and cart',
    icon: 'ShoppingBag',
    samplePrompt:
      'A storefront for a speciality coffee roaster with a product grid, product detail page and a slide-over cart',
    expectedPages: ['Catalogue', 'Product detail', 'Cart'],
    coreEntities: ['Product', 'Variant', 'CartItem'],
    qualityBar: [
      'Cart state is real: add, remove and quantity changes update the total',
      'Product cards show price, image placeholder and availability',
      'Detail page has variant selection and an add-to-cart that works',
    ],
    suggestedPackages: ['lucide-react', 'zustand'],
    designHint: 'Product-led. Large imagery, quiet chrome, unmistakable buy button.',
  },
  {
    id: 'project-tracker',
    name: 'Project tracker',
    description: 'Board, tasks, assignees and status',
    icon: 'KanbanSquare',
    samplePrompt:
      'A project tracker with a board grouped by status, task cards with assignees and due dates, and a quick-add form',
    expectedPages: ['Board', 'Task detail', 'Backlog'],
    coreEntities: ['Project', 'Task', 'Assignee', 'Status'],
    qualityBar: [
      'Columns are derived from status, with counts per column',
      'Creating a task actually appends it to state and renders',
      'Overdue tasks are visually distinct',
    ],
    suggestedPackages: ['lucide-react', 'date-fns'],
    designHint: 'Compact cards, clear column rhythm, colour reserved for priority and overdue.',
  },
  {
    id: 'blog',
    name: 'Publication',
    description: 'Article index, reading view and topics',
    icon: 'BookOpen',
    samplePrompt:
      'A publication homepage with a featured article, a chronological index and topic filtering',
    expectedPages: ['Index', 'Article', 'Topic'],
    coreEntities: ['Post', 'Author', 'Topic'],
    qualityBar: [
      'Typography is the design: measure, leading and hierarchy are deliberate',
      'Articles carry author, date and reading time',
      'Topic filter narrows the index',
    ],
    suggestedPackages: ['lucide-react', 'date-fns'],
    designHint: 'Editorial. Long measure, strong display face, minimal ornament.',
  },
  {
    id: 'admin-panel',
    name: 'Admin panel',
    description: 'CRUD tables, forms and role management',
    icon: 'Table2',
    samplePrompt:
      'An internal admin panel for managing users and subscriptions, with searchable tables and edit forms',
    expectedPages: ['Records list', 'Record editor', 'Audit log'],
    coreEntities: ['Record', 'User', 'Role', 'AuditEvent'],
    qualityBar: [
      'Tables paginate and show a row count',
      'Forms validate and show inline errors',
      'Destructive actions ask for confirmation',
    ],
    suggestedPackages: ['lucide-react', 'react-hook-form', 'zod'],
    designHint: 'Plain and fast. No decoration that slows down a daily operator.',
  },
  {
    id: 'booking',
    name: 'Booking',
    description: 'Availability, slot picking and confirmation',
    icon: 'CalendarClock',
    samplePrompt:
      'A booking page for a barber shop with service selection, a weekly availability grid and a confirmation step',
    expectedPages: ['Service selection', 'Time picker', 'Confirmation'],
    coreEntities: ['Service', 'Slot', 'Booking', 'Provider'],
    qualityBar: [
      'Taken slots are visibly unavailable and cannot be selected',
      'The flow has real steps with back navigation',
      'Confirmation restates every choice the user made',
    ],
    suggestedPackages: ['lucide-react', 'date-fns'],
    designHint: 'Stepwise and reassuring. One decision per screen.',
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Personal site with work, about and contact',
    icon: 'Frame',
    samplePrompt:
      'A portfolio for a product designer with a project grid, case-study pages and a contact section',
    expectedPages: ['Home', 'Project detail', 'About'],
    coreEntities: ['Project', 'Role', 'ContactMessage'],
    qualityBar: [
      'Work is the hero; chrome stays out of the way',
      'Each project has context, role and outcome, not just an image',
      'Contact route is obvious from any screen',
    ],
    suggestedPackages: ['lucide-react', 'framer-motion'],
    designHint: 'Opinionated and personal. Asymmetry is welcome here.',
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'Threads, message list and composer',
    icon: 'MessagesSquare',
    samplePrompt:
      'A team chat interface with a channel sidebar, a message thread and a composer with attachments',
    expectedPages: ['Conversation', 'Thread panel'],
    coreEntities: ['Conversation', 'Message', 'Participant'],
    qualityBar: [
      'Sending a message appends it and scrolls the list',
      'Messages group by author and show timestamps',
      'Sidebar shows unread state',
    ],
    suggestedPackages: ['lucide-react', 'date-fns'],
    designHint: 'Quiet frame, legible message body, generous tap targets.',
  },
];

export const ARCHETYPE_IDS = APP_ARCHETYPES.map((a) => a.id);

export function getArchetype(id: string | undefined | null): AppArchetype | undefined {
  if (!id) return undefined;
  return APP_ARCHETYPES.find((a) => a.id === id);
}

/**
 * Best-effort archetype detection from free text. Used when the user just
 * types a description without picking a chip, so the planner still gets a
 * prior. Deliberately conservative: no match is better than a wrong one.
 */
export function inferArchetype(prompt: string): AppArchetype | undefined {
  const p = prompt.toLowerCase();

  const rules: Array<[string, RegExp]> = [
    ['saas-dashboard', /\b(dashboard|analytics|metrics|kpi|admin overview|reporting)\b/],
    ['ecommerce', /\b(shop|store|storefront|e-?commerce|cart|checkout|product catalog(ue)?)\b/],
    ['crm', /\b(crm|pipeline|leads?|deals?|customer relationship)\b/],
    ['project-tracker', /\b(kanban|task tracker|project (tracker|management)|issue tracker|todo app)\b/],
    ['booking', /\b(booking|appointment|reservation|scheduling|calendar app)\b/],
    ['blog', /\b(blog|publication|magazine|articles?|newsletter archive)\b/],
    ['chat', /\b(chat|messaging|inbox|conversation)\b/],
    ['portfolio', /\b(portfolio|personal site|my work|case stud(y|ies))\b/],
    ['admin-panel', /\b(admin panel|back ?office|internal tool|crud)\b/],
    ['landing-page', /\b(landing page|marketing site|waitlist|coming soon|product page)\b/],
  ];

  for (const [id, re] of rules) {
    if (re.test(p)) return getArchetype(id);
  }
  return undefined;
}

export default APP_ARCHETYPES;
