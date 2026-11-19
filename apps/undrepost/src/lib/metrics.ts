/**
 * Minimal pino-style structured metrics (T2.10): in-process gauges/counters
 * dumped as one JSON log line per interval by startMetricsReporter(). Payload's
 * logger is the transport; a metrics backend (OTel/Prometheus) can replace the
 * reporter without touching call sites.
 */

const counters = new Map<string, number>()

const gauges = new Map<string, number>()

export function incrCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by)
}

export function setGauge(name: string, value: number): void {
  gauges.set(name, value)
}

export function snapshot(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [name, value] of counters) {
    out[name] = value
  }
  for (const [name, value] of gauges) {
    out[`gauge.${name}`] = value
  }
  return out
}

export function startMetricsReporter(logger: {
  info: (o: Record<string, unknown>) => void
}): () => void {
  const intervalMs = 60_000
  const timer = setInterval(() => {
    logger.info({ metrics: snapshot(), msg: 'metrics-report' })
  }, intervalMs)
  // Do not hold the process open for the reporter alone.
  timer.unref?.()
  return () => clearInterval(timer)
}
