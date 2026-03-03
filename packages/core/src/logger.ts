// ─── Structured Logger ──────────────────────────────────────────────
// Lightweight JSON logger for API and engine observability.
// Uses structured fields so logs can be parsed by any log aggregator.

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  dealId?: string;
  userId?: string;
  engine?: string;
  scenario?: string;
  trigger?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, ctx?: LogContext) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...ctx,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};
