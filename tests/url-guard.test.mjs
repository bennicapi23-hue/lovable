import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { guardUrl, isSafeUrl } from '@/lib/security/url-guard.ts';

describe('guardUrl — addresses that must never be fetched', () => {
  // Each of these is a way to reach something the user cannot reach directly.
  const blocked = [
    ['loopback v4', 'http://127.0.0.1:3000/admin'],
    ['loopback name', 'http://localhost:8080'],
    ['loopback v6', 'http://[::1]/'],
    ['unspecified', 'http://0.0.0.0/'],
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['gcp metadata', 'http://metadata.google.internal/'],
    ['private 10/8', 'http://10.0.0.5/'],
    ['private 172.16/12', 'http://172.20.1.1/'],
    ['private 192.168/16', 'http://192.168.1.1/'],
    ['CGNAT', 'http://100.100.0.1/'],
    ['link-local v6', 'http://[fe80::1]/'],
    ['unique local v6', 'http://[fd00::1]/'],
    ['ipv4-mapped private', 'http://[::ffff:10.0.0.1]/'],
    ['.internal suffix', 'http://vault.internal/'],
    ['.local suffix', 'http://printer.local/'],
    ['bare internal name', 'http://intranet'],
  ];

  for (const [label, url] of blocked) {
    test(`rejects ${label}`, () => {
      const result = guardUrl(url);
      assert.equal(result.ok, false, `${url} should be rejected`);
      assert.ok(result.reason, 'a rejection must explain itself');
    });
  }

  test('rejects non-http protocols', () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com', 'gopher://example.com']) {
      assert.equal(guardUrl(url).ok, false, `${url} should be rejected`);
    }
  });

  test('rejects embedded credentials', () => {
    // user@host is a classic way to make a blocked host look like a safe one.
    assert.equal(guardUrl('https://user:pass@example.com').ok, false);
    assert.equal(guardUrl('https://169.254.169.254@example.com').ok, false);
  });

  test('rejects empty and non-string input', () => {
    for (const value of ['', '   ', null, undefined, 42, {}]) {
      assert.equal(guardUrl(value).ok, false);
    }
  });

  test('rejects an absurdly long URL', () => {
    assert.equal(guardUrl(`https://example.com/${'a'.repeat(3000)}`).ok, false);
  });
});

describe('guardUrl — addresses that must be allowed', () => {
  test('accepts ordinary public URLs', () => {
    for (const url of [
      'https://example.com',
      'http://example.com/path?q=1#frag',
      'https://sub.domain.example.co.uk/a/b',
    ]) {
      assert.equal(guardUrl(url).ok, true, `${url} should be allowed`);
    }
  });

  test('assumes https for a bare domain, because that is what people type', () => {
    const result = guardUrl('example.com');
    assert.equal(result.ok, true);
    assert.ok(result.url.startsWith('https://'));
  });

  test('normalises the returned URL', () => {
    const result = guardUrl('  https://example.com  ');
    assert.equal(result.ok, true);
    assert.equal(result.url, 'https://example.com/');
  });

  test('a public IP is fine', () => {
    assert.equal(guardUrl('http://93.184.216.34/').ok, true);
  });

  test('isSafeUrl mirrors guardUrl', () => {
    assert.equal(isSafeUrl('https://example.com'), true);
    assert.equal(isSafeUrl('http://127.0.0.1'), false);
  });
});
