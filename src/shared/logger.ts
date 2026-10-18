type Level = 'debug' | 'info' | 'warn' | 'error';

const MAX_VALUE_LEN = 40;
const SENSITIVE_PATTERNS: RegExp[] = [
  /(sk-[A-Za-z0-9_-]{4,})/g,
  /(Bearer\s+[A-Za-z0-9._-]{4,})/gi,
  /("?api[_-]?key"?\s*[:=]\s*["']?)[A-Za-z0-9._-]{4,}/gi,
  /(authorization["'\s:=]+)[A-Za-z0-9._-]{6,}/gi,
];

let debugEnabled = false;

export function setDebugLogging(enabled: boolean): void {
  debugEnabled = enabled;
}

function redact(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let out = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, (_match, group1: string) => `${group1}[REDACTED]`);
  }
  if (out.length > MAX_VALUE_LEN) {
    out = `${out.slice(0, MAX_VALUE_LEN)}…(+${out.length - MAX_VALUE_LEN} chars)`;
  }
  return out;
}

function emit(level: Level, message: string, fields?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = { level, message };
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      payload[key] = redact(value);
    }
  }
  const line = `[mailbrief] ${JSON.stringify(payload)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug' && debugEnabled) console.debug(line);
  else if (level === 'info') console.info(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => emit('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit('error', message, fields),
};

export const redactString = redact;
