/**
 * Validation for user-supplied URLs before the server fetches them.
 *
 * Every scrape endpoint takes a URL from the browser and fetches it from the
 * server. Without a check, that turns the product into a proxy for reaching
 * anything the server can reach but the user cannot: cloud metadata endpoints
 * (169.254.169.254), services on localhost, and hosts inside a private
 * network. This module is the single place that decides whether a URL is
 * safe to fetch.
 *
 * DNS rebinding is out of scope here: we validate the literal host, and a
 * hostname that resolves to a private address still passes. Firecrawl (the
 * scraping provider) performs the fetch and applies its own egress controls,
 * so this is the first of two gates rather than the only one.
 */

export interface UrlGuardResult {
  ok: boolean;
  /** Normalised, safe-to-use URL. Present when ok. */
  url?: string;
  /** Human-readable reason, safe to show the user. Present when not ok. */
  reason?: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Hostnames that always refer to the machine running the server. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

/** Suffixes used for names that only resolve inside a private network. */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;

  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return true; // malformed: refuse

  if (a === 0) return true;                        // 0.0.0.0/8  this network
  if (a === 10) return true;                       // 10/8       private
  if (a === 127) return true;                      // 127/8      loopback
  if (a === 169 && b === 254) return true;         // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;// 172.16/12  private
  if (a === 192 && b === 168) return true;         // 192.168/16 private
  if (a === 192 && b === 0 && c === 0) return true;// IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a >= 224) return true;                       // multicast + reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::' || h === '::1') return true;      // unspecified, loopback
  if (h.startsWith('fe80')) return true;           // link-local
  if (/^f[cd]/.test(h)) return true;               // unique local fc00::/7
  // IPv4-mapped (::ffff:10.0.0.1) inherits the IPv4 rules.
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

/**
 * Validates and normalises a URL supplied by a user.
 *
 * Accepts bare hostnames ("example.com") by assuming https, which is what
 * people type into the composer.
 */
export function guardUrl(input: unknown): UrlGuardResult {
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, reason: 'Enter a URL.' };
  }

  const candidate = input.trim();
  if (candidate.length > 2048) {
    return { ok: false, reason: 'That URL is too long.' };
  }

  // Reject credentials in the URL before parsing normalises them away.
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i.test(candidate)) {
    return { ok: false, reason: 'URLs with embedded credentials are not allowed.' };
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, reason: 'That does not look like a valid URL.' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: 'Only http and https URLs can be fetched.' };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) {
    return { ok: false, reason: 'That URL has no host.' };
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return { ok: false, reason: 'That address is not reachable from the builder.' };
  }

  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    return { ok: false, reason: 'Private and loopback addresses cannot be fetched.' };
  }

  // A host with no dot is a bare name that only resolves on an internal
  // network (e.g. "intranet"). Public sites always have a registrable domain.
  if (!hostname.includes('.') && !hostname.startsWith('[')) {
    return { ok: false, reason: 'Enter a full domain, for example example.com.' };
  }

  return { ok: true, url: url.toString() };
}

/** True when the URL is safe to fetch. Convenience wrapper for call sites. */
export function isSafeUrl(input: unknown): boolean {
  return guardUrl(input).ok;
}
