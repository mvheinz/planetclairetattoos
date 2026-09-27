import 'server-only'

import { getEnv } from '../env'
import { redact } from '../security/redact'

// Einziger Logger (ARCHITEKTUR §8.11): JSON-Zeilen nach stdout, ohne Personendaten.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export type LogFields = Record<string, unknown>
export type LogSink = (line: string, level: LogLevel) => void

const defaultSink: LogSink = (line, level) => {
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export interface Logger {
  debug(event: string, fields?: LogFields): void
  info(event: string, fields?: LogFields): void
  warn(event: string, fields?: LogFields): void
  error(event: string, fields?: LogFields): void
}

export function createLogger(
  options: { level?: LogLevel; sink?: LogSink; now?: () => Date } = {},
): Logger {
  const min = ORDER[options.level ?? 'info']
  const sink = options.sink ?? defaultSink
  const now = options.now ?? (() => new Date())
  const write = (level: LogLevel, event: string, fields: LogFields = {}) => {
    if (ORDER[level] < min) return
    const record = { level, time: now().toISOString(), event, ...(redact(fields) as LogFields) }
    sink(JSON.stringify(record), level)
  }
  return {
    debug: (e, f) => write('debug', e, f),
    info: (e, f) => write('info', e, f),
    warn: (e, f) => write('warn', e, f),
    error: (e, f) => write('error', e, f),
  }
}

function levelFromEnv(): LogLevel {
  // Ohne gültige Umgebung (z. B. frühe Startfehler) trotzdem loggen können.
  try {
    return getEnv().LOG_LEVEL
  } catch {
    return 'info'
  }
}

let shared: Logger | undefined
export function getLogger(): Logger {
  if (!shared) shared = createLogger({ level: levelFromEnv() })
  return shared
}

export const logger: Logger = {
  debug: (e, f) => getLogger().debug(e, f),
  info: (e, f) => getLogger().info(e, f),
  warn: (e, f) => getLogger().warn(e, f),
  error: (e, f) => getLogger().error(e, f),
}
