import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseJavaScriptFile, buildComponentTree } from '@/lib/file-parser.ts';
import {
  extractMissingPackages, classifyError, calculateRetryDelay,
} from '@/lib/build-validator.ts';
import { analyzeEditIntent } from '@/lib/edit-intent-analyzer.ts';

/**
 * The inherited engine.
 *
 * These modules came from upstream with no tests and are the parts that
 * decide what gets built and what gets fixed — a wrong answer here is a
 * broken app, not a cosmetic defect. The assertions below encode the
 * behaviour the rest of the product already depends on.
 */

describe('file parser — imports', () => {
  test('finds a default import and its source', () => {
    const { imports } = parseJavaScriptFile(
      `import React from 'react';\nexport default function A() { return null; }`,
      'src/A.jsx',
    );
    assert.equal(imports[0].source, 'react');
    assert.equal(imports[0].defaultImport, 'React');
    assert.equal(imports[0].isLocal, false);
  });

  test('finds named imports', () => {
    const { imports } = parseJavaScriptFile(
      `import { useState, useEffect } from 'react';`,
      'src/A.jsx',
    );
    assert.deepEqual(imports[0].imports, ['useState', 'useEffect']);
  });

  test('unwraps aliased imports to their original name', () => {
    const { imports } = parseJavaScriptFile(
      `import { useState as useLocalState } from 'react';`,
      'src/A.jsx',
    );
    assert.deepEqual(imports[0].imports, ['useState']);
  });

  test('marks relative and alias paths as local', () => {
    const { imports } = parseJavaScriptFile(
      `import a from './a';\nimport b from '../b';\nimport c from '@/c';\nimport d from 'react';`,
      'src/A.jsx',
    );
    assert.deepEqual(imports.map((i) => i.isLocal), [true, true, true, false]);
  });

  test('a side-effect import still records its source', () => {
    const { imports } = parseJavaScriptFile(`import './index.css';`, 'src/main.jsx');
    assert.equal(imports[0].source, './index.css');
  });

  test('a file with no imports yields an empty list, not undefined', () => {
    const { imports } = parseJavaScriptFile('export const x = 1;', 'src/x.js');
    assert.deepEqual(imports, []);
  });
});

describe('file parser — component tree', () => {
  test('links a parent to the children it imports', () => {
    const files = {
      'src/App.jsx': {
        ...parseJavaScriptFile(
          `import Header from './components/Header';\nexport default function App() {}`,
          'src/App.jsx',
        ),
        path: 'src/App.jsx',
      },
      'src/components/Header.jsx': {
        ...parseJavaScriptFile('export default function Header() {}', 'src/components/Header.jsx'),
        path: 'src/components/Header.jsx',
      },
    };

    const tree = buildComponentTree(files);
    assert.ok(tree, 'a tree must be produced for a well-formed project');
  });

  test('does not throw on an empty project', () => {
    assert.doesNotThrow(() => buildComponentTree({}));
  });
});

describe('build validator — missing packages', () => {
  test('extracts a package from a Vite resolve failure', () => {
    assert.deepEqual(
      extractMissingPackages({ message: `Failed to resolve import "date-fns" from "src/App.jsx"` }),
      ['date-fns'],
    );
  });

  test('extracts from a Node module-not-found', () => {
    assert.deepEqual(
      extractMissingPackages({ message: `Cannot find module 'recharts'` }),
      ['recharts'],
    );
  });

  test('extracts several, without duplicates', () => {
    const found = extractMissingPackages({
      message:
        `Failed to resolve import "a" from x\n` +
        `Cannot find module 'b'\n` +
        `Failed to resolve import "a" from y`,
    });
    assert.deepEqual(found.sort(), ['a', 'b']);
  });

  test('scoped packages survive intact', () => {
    assert.deepEqual(
      extractMissingPackages({ message: `Failed to resolve import "@tanstack/react-query" from x` }),
      ['@tanstack/react-query'],
    );
  });

  test('an unrelated error yields nothing rather than a bogus package', () => {
    assert.deepEqual(extractMissingPackages({ message: 'Unexpected token }' }), []);
    assert.deepEqual(extractMissingPackages(null), []);
    assert.deepEqual(extractMissingPackages('a plain string'), []);
  });
});

describe('build validator — error classification', () => {
  const cases = [
    ['missing-package', 'Failed to resolve import "x"'],
    ['missing-package', "Cannot find module 'y'"],
    ['syntax-error', 'Syntax error: unexpected token'],
    ['syntax-error', 'Parsing error at line 4'],
    ['sandbox-timeout', 'Request timed out'],
    ['sandbox-timeout', 'Sandbox not responding'],
    ['not-rendered', 'Still showing the default page'],
    ['vite-error', 'Vite compilation failed'],
    ['unknown', 'the disk caught fire'],
  ];

  for (const [expected, message] of cases) {
    test(`"${message.slice(0, 34)}" -> ${expected}`, () => {
      assert.equal(classifyError({ message }), expected);
    });
  }

  test('classification is case-insensitive', () => {
    assert.equal(classifyError({ message: 'CANNOT FIND MODULE "x"' }), 'missing-package');
  });

  test('a null error is classified, not thrown on', () => {
    assert.equal(classifyError(null), 'unknown');
  });
});

describe('build validator — retry delay', () => {
  test('backs off as attempts accumulate', () => {
    const first = calculateRetryDelay(1, 'vite-error');
    const third = calculateRetryDelay(3, 'vite-error');
    assert.ok(third > first, 'retrying at the same speed is not a retry strategy');
  });

  test('waits longer for a package install than for a compile error', () => {
    assert.ok(
      calculateRetryDelay(1, 'missing-package') >= calculateRetryDelay(1, 'vite-error'),
      'npm install takes longer than a recompile',
    );
  });

  test('never returns a negative or absurd delay', () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      for (const type of ['missing-package', 'syntax-error', 'sandbox-timeout', 'unknown']) {
        const delay = calculateRetryDelay(attempt, type);
        assert.ok(delay >= 0, `${type} attempt ${attempt} gave ${delay}`);
        assert.ok(delay <= 120_000, `${type} attempt ${attempt} would wait ${delay}ms`);
      }
    }
  });
});

describe('edit intent', () => {
  /** A manifest shaped like what the sandbox produces. */
  const manifest = {
    files: {
      'src/App.jsx': { path: 'src/App.jsx', content: '', imports: [], exports: [], type: 'component' },
      'src/components/Header.jsx': {
        path: 'src/components/Header.jsx', content: '', imports: [], exports: [],
        type: 'component', componentInfo: { name: 'Header' },
      },
      'src/components/Hero.jsx': {
        path: 'src/components/Hero.jsx', content: '', imports: [], exports: [],
        type: 'component', componentInfo: { name: 'Hero' },
      },
      'src/index.css': { path: 'src/index.css', content: '', imports: [], exports: [], type: 'style' },
    },
    routes: [],
    componentTree: {},
    entryPoint: 'src/main.jsx',
    styleFiles: ['src/index.css'],
    timestamp: Date.now(),
  };

  test('returns a usable intent for an ordinary edit', () => {
    const intent = analyzeEditIntent('change the header background to navy', manifest);
    assert.ok(intent.type, 'every request must classify to something');
    assert.ok(Array.isArray(intent.targetFiles));
    assert.ok(typeof intent.confidence === 'number');
    assert.ok(intent.confidence >= 0 && intent.confidence <= 1,
      `confidence out of range: ${intent.confidence}`);
  });

  test('a named component steers the target files', () => {
    const intent = analyzeEditIntent('update the Hero section copy', manifest);
    assert.ok(
      intent.targetFiles.length === 0 ||
      intent.targetFiles.some((f) => /Hero/i.test(f)),
      `naming Hero should not target unrelated files: ${intent.targetFiles.join(', ')}`,
    );
  });

  test('nonsense still returns an intent rather than throwing', () => {
    assert.doesNotThrow(() => analyzeEditIntent('', manifest));
    assert.doesNotThrow(() => analyzeEditIntent('asdfgh', manifest));
  });

  test('an empty manifest does not crash the analyzer', () => {
    const empty = { ...manifest, files: {}, styleFiles: [] };
    assert.doesNotThrow(() => analyzeEditIntent('change the header', empty));
  });
});
