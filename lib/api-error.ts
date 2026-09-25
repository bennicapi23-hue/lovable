/**
 * Turns a failed API response into something worth showing a person.
 *
 * The generation endpoints answer refusals with a reason and, where one
 * exists, a way out: 402 carries the exhausted plan and an upgrade path, 429
 * carries a retry time. Throwing `HTTP error! status: 402` discards all of
 * that and leaves the user staring at a number, so every call site that can
 * fail should go through here.
 */

interface ApiErrorBody {
  error?: string;
  message?: string;
  plan?: string;
  resetsAt?: string;
  upgrade?: string;
}

/** Seconds until retry, from the Retry-After header. */
function retryAfterSeconds(response: { headers: { get(name: string): string | null } }): number | null {
  const raw = response.headers.get('Retry-After');
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

function formatReset(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return ` Your allowance resets on ${date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
  })}.`;
}

/**
 * Reads the body of a failed response and builds a message for the user.
 * Never throws: a failure to parse the failure must not replace the original
 * problem with a parsing error.
 */
export async function describeApiError(
  response: Response,
  fallback = 'The request failed.',
): Promise<string> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.clone().json()) as ApiErrorBody;
  } catch {
    // Not JSON, or already consumed. The status still tells us something.
  }

  const server = body.error || body.message;

  switch (response.status) {
    case 402: {
      const base = server || 'You have used your plan allowance for this month.';
      const reset = formatReset(body.resetsAt);
      const upgrade = body.upgrade ? ` See ${body.upgrade} for more.` : '';
      return `${base}${reset}${upgrade}`;
    }
    case 429: {
      const seconds = retryAfterSeconds(response);
      const wait = seconds ? ` Try again in ${seconds} second${seconds === 1 ? '' : 's'}.` : '';
      return `${server || 'Too many requests.'}${wait}`;
    }
    case 401:
    case 403:
      return server || 'This deployment is not authorised to use that provider. Check its API key.';
    case 502:
    case 503:
      return server || 'The AI provider is unavailable right now. Try again shortly.';
    default:
      return server || `${fallback} (HTTP ${response.status})`;
  }
}
