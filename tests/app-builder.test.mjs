import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_ARCHETYPES,
  getArchetype,
  inferArchetype,
} from '@/lib/app-builder/archetypes.ts';
import {
  normaliseBlueprint,
  buildPlannerPrompt,
  installablePackages,
} from '@/lib/app-builder/blueprint.ts';
import { buildGreenfieldPrompt } from '@/lib/app-builder/build-prompt.ts';
import { appConfig } from '@/config/app.config.ts';

/** A minimal plan shaped like what the model returns. */
function sampleBlueprint(overrides = {}) {
  return {
    name: 'Pipewright',
    tagline: 'Job tracking for plumbers',
    summary: 'Track customers, jobs and invoices.',
    archetype: 'crm',
    audience: 'Small plumbing businesses',
    design: {
      direction: 'Utilitarian with a warm accent',
      palette: {
        primary: '#6244F5',
        accent: '#F2B441',
        background: '#FAFAF9',
        surface: '#FFFFFF',
        text: '#12121C',
      },
      typography: { display: 'Inter', body: 'Inter' },
      mood: ['practical', 'calm'],
      density: 'balanced',
      radius: 'soft',
      darkMode: false,
    },
    pages: [
      { name: 'Jobs', route: '/', purpose: 'See scheduled work', sections: ['List', 'Filters'] },
    ],
    components: [
      { name: 'JobList', file: 'components/JobList.jsx', role: 'Lists jobs' },
    ],
    dataModel: [
      { entity: 'Job', fields: [{ name: 'id', type: 'string', example: 'j_01' }] },
    ],
    features: [{ name: 'Schedule a job', description: 'Pick a date', priority: 'core' }],
    packages: ['date-fns', 'react'],
    notes: ['Invoicing deferred'],
    ...overrides,
  };
}

describe('archetypes', () => {
  test('every archetype is complete enough to steer a plan', () => {
    for (const a of APP_ARCHETYPES) {
      assert.ok(a.id && a.name && a.description, `${a.id} missing identity`);
      assert.ok(a.samplePrompt.length > 20, `${a.id} sample prompt is too thin`);
      assert.ok(a.expectedPages.length > 0, `${a.id} has no expected pages`);
      assert.ok(a.qualityBar.length > 0, `${a.id} has no quality bar`);
    }
  });

  test('archetype ids are unique', () => {
    const ids = APP_ARCHETYPES.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('getArchetype handles absent input rather than throwing', () => {
    assert.equal(getArchetype(undefined), undefined);
    assert.equal(getArchetype(null), undefined);
    assert.equal(getArchetype('nope'), undefined);
    assert.equal(getArchetype('crm')?.id, 'crm');
  });

  test('inferArchetype recognises the obvious cases', () => {
    assert.equal(inferArchetype('a dashboard showing revenue')?.id, 'saas-dashboard');
    assert.equal(inferArchetype('an online shop with a cart')?.id, 'ecommerce');
    assert.equal(inferArchetype('a kanban task tracker')?.id, 'project-tracker');
    assert.equal(inferArchetype('a booking page for a salon')?.id, 'booking');
  });

  test('inferArchetype stays silent rather than guessing wrong', () => {
    assert.equal(inferArchetype('something entirely unlike any of these'), undefined);
  });
});

describe('normaliseBlueprint', () => {
  test('guarantees an App entry component even when the model omits it', () => {
    const result = normaliseBlueprint(sampleBlueprint());
    const app = result.components.find((c) => c.file === 'src/App.jsx');
    assert.ok(app, 'App.jsx must be in the file list the generator writes');
  });

  test('does not duplicate App when the model already planned it', () => {
    const result = normaliseBlueprint(
      sampleBlueprint({
        components: [{ name: 'App', file: 'src/App.jsx', role: 'Shell' }],
      }),
    );
    assert.equal(result.components.filter((c) => c.file === 'src/App.jsx').length, 1);
  });

  test('rewrites component paths under src/', () => {
    const result = normaliseBlueprint(sampleBlueprint());
    for (const c of result.components) {
      assert.ok(c.file.startsWith('src/'), `${c.file} should be under src/`);
    }
  });

  test('always produces at least one page', () => {
    const result = normaliseBlueprint(sampleBlueprint({ pages: [] }));
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].route, '/');
  });

  test('drops entries the model left blank', () => {
    const result = normaliseBlueprint(
      sampleBlueprint({
        pages: [{ name: '  ', route: '/x', purpose: '', sections: [] }],
        dataModel: [{ entity: '', fields: [] }],
        packages: ['date-fns', 'date-fns', '  '],
      }),
    );
    assert.equal(result.dataModel.length, 0);
    assert.deepEqual(result.packages, ['date-fns']);
  });

  test('falls back to a known archetype when the model invents one', () => {
    const result = normaliseBlueprint(sampleBlueprint({ archetype: 'not-a-real-archetype' }));
    assert.ok(getArchetype(result.archetype), 'archetype must resolve');
  });

  test('caps an over-ambitious plan so the build does not run out of tokens', () => {
    const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
    const result = normaliseBlueprint(
      sampleBlueprint({
        pages: many(30, (i) => ({
          name: `Page ${i}`, route: `/p${i}`, purpose: 'p', sections: [],
        })),
        components: many(80, (i) => ({
          name: `C${i}`, file: `components/C${i}.jsx`, role: 'r',
        })),
      }),
    );
    assert.equal(result.pages.length, appConfig.appBuilder.maxPages);
    // +1 for the App shell normaliseBlueprint guarantees.
    assert.ok(result.components.length <= appConfig.appBuilder.maxComponents + 1);
  });

  test('says when it trimmed, rather than shortening the plan silently', () => {
    const result = normaliseBlueprint(
      sampleBlueprint({
        pages: Array.from({ length: 30 }, (_, i) => ({
          name: `Page ${i}`, route: `/p${i}`, purpose: 'p', sections: [],
        })),
      }),
    );
    assert.ok(
      result.notes.some((n) => /trimmed/i.test(n)),
      'a trimmed plan must say so in its notes',
    );
  });

  test('a plan within the caps gains no trimming note', () => {
    const result = normaliseBlueprint(sampleBlueprint());
    assert.ok(!result.notes.some((n) => /trimmed/i.test(n)));
  });

  test('never leaves the app nameless', () => {
    const result = normaliseBlueprint(sampleBlueprint({ name: '   ' }), {
      fallbackName: 'Fallback',
    });
    assert.equal(result.name, 'Fallback');
  });
});

describe('installablePackages', () => {
  test('filters out what the sandbox already provides', () => {
    const blueprint = normaliseBlueprint(
      sampleBlueprint({ packages: ['react', 'react-dom', 'tailwindcss', 'recharts'] }),
    );
    assert.deepEqual(installablePackages(blueprint), ['recharts']);
  });
});

describe('prompts', () => {
  test('the planner prompt carries the request and the archetype prior', () => {
    const prompt = buildPlannerPrompt('a CRM for plumbers', getArchetype('crm'));
    assert.ok(prompt.includes('a CRM for plumbers'));
    assert.ok(prompt.includes('CRM'));
    assert.ok(/Contact/.test(prompt), 'archetype entities should reach the planner');
  });

  test('the planner prompt still works with no archetype', () => {
    const prompt = buildPlannerPrompt('something unusual', undefined);
    assert.ok(prompt.includes('something unusual'));
    assert.ok(prompt.includes('No archetype matched'));
  });

  test('the build prompt names every file the generator must write', () => {
    const blueprint = normaliseBlueprint(sampleBlueprint());
    const prompt = buildGreenfieldPrompt(blueprint, 'a CRM for plumbers');
    for (const c of blueprint.components) {
      assert.ok(prompt.includes(c.file), `${c.file} missing from the build prompt`);
    }
  });

  test('the build prompt carries the exact palette, not a description of it', () => {
    const blueprint = normaliseBlueprint(sampleBlueprint());
    const prompt = buildGreenfieldPrompt(blueprint, 'a CRM');
    assert.ok(prompt.includes('#6244F5'));
    assert.ok(prompt.includes('#F2B441'));
  });

  test('a multi-page plan asks for a router; a single-page one does not', () => {
    const single = buildGreenfieldPrompt(normaliseBlueprint(sampleBlueprint()), 'x');
    assert.ok(single.includes('no router'));

    const multi = buildGreenfieldPrompt(
      normaliseBlueprint(
        sampleBlueprint({
          pages: [
            { name: 'A', route: '/', purpose: 'p', sections: [] },
            { name: 'B', route: '/b', purpose: 'p', sections: [] },
          ],
        }),
      ),
      'x',
    );
    assert.ok(multi.includes('react-router-dom'));
  });

  test('extra user instructions are passed through', () => {
    const prompt = buildGreenfieldPrompt(
      normaliseBlueprint(sampleBlueprint()),
      'a CRM',
      'make it Italian language',
    );
    assert.ok(prompt.includes('make it Italian language'));
  });
});
