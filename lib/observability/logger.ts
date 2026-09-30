/**
 * Structured logging.
 *
 * 215 bare console.log calls were inherited, which is fine on a laptop and
 * useless in production: you cannot filter, count or alert on prose. This
 * emits JSON lines in production — greppable, and ingestible by any log
 * platform without a parser — and stays human-readable in development, where
 * a person is watching the terminal.
 *
 * Deliberately dependency-free. A logging library would be the third-largest
 * dependency here for behaviour that is forty lines.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (configured && configured in LEVELS) return LEVELS[configured];
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

/**
 * Evaluated per call, not at import.
 *
 * Fixing the format at module load makes it impossible to change LOG_LEVEL
 * without a restart, and impossible to test at all — the module is imported
 * once and remembers whatever the environment looked like at that instant.
 * The cost is one comparison per line.
 */
function isPretty(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Keys whose values must never reach a log line.
 *
 * Logs travel further than the data in them: into a third-party platform, a
 * support ticket, a screenshot. A key that even looks like a credential is
 * redacted rather than reasoned about.
 */
const SECRET_KEY = /(key|secret|token|password|authorization|cookie|signature)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(inner, depth + 1);
  }
  return out;
}

export interface LogFields {
  /** Which account this concerns. Never an email — ids are not personal data. */
  accountId?: string;
  /** Correlates every line from one build. */
  buildId?: string;
  sandboxId?: string;
  projectId?: string;
  model?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  if (LEVELS[level] < threshold()) return;

  if (isPretty()) {
    const extra = fields && Object.keys(fields).length ? ` ${JSON.stringify(redact(fields))}` : '';
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`[${scope}] ${message}${extra}`);
    return;
  }

  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](
    JSON.stringify({
      level,
      scope,
      message,
      time: new Date().toISOString(),
      ...(redact(fields ?? {}) as object),
    }),
  );
}

/** A logger bound to one subsystem, so every line says where it came from. */
export function createLogger(scope: string) {
  return {
    debug: (message: string, fields?: LogFields) => emit('debug', scope, message, fields),
    info: (message: string, fields?: LogFields) => emit('info', scope, message, fields),
    warn: (message: string, fields?: LogFields) => emit('warn', scope, message, fields),
    error: (message: string, error?: unknown, fields?: LogFields) =>
      emit('error', scope, message, {
        ...fields,
        ...(error instanceof Error
          ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
          : error !== undefined
            ? { error: String(error) }
            : {}),
      }),
    /** Child logger carrying fields every line should repeat. */
    with: (bound: LogFields) => ({
      debug: (m: string, f?: LogFields) => emit('debug', scope, m, { ...bound, ...f }),
      info: (m: string, f?: LogFields) => emit('info', scope, m, { ...bound, ...f }),
      warn: (m: string, f?: LogFields) => emit('warn', scope, m, { ...bound, ...f }),
      error: (m: string, e?: unknown, f?: LogFields) =>
        emit('error', scope, m, {
          ...bound,
          ...f,
          ...(e instanceof Error ? { errorName: e.name, errorMessage: e.message } : {}),
        }),
    }),
  };
}

export type Logger = ReturnType<typeof createLogger>;
