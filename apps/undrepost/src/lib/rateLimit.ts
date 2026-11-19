import { incrCounter } from './metrics'

/**
 * In-memory sliding-window rate limiter (T2.1b / FR-011 defaults: 10
 * comments/hour). Per-instance state — the Redis-backed shared limiter lands
 * with T2.7 behind the same checkRateLimit seam.
 */

const buckets = new Map<string, number[]>()

// Prune bookkeeping to keep the map bounded on long-running processes.
const BUCKET_PRUNE_THRESHOLD = 10_000

export type RateLimitRule = {
  limit: number
  windowMs: number
}

export const COMMENT_RATE_LIMIT: RateLimitRule = {
  limit: Number(process.env.COMMENT_RATE_LIMIT || 10),
  windowMs: 60 * 60 * 1000,
}

export const SUBSCRIBE_RATE_LIMIT: RateLimitRule = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
}

export function checkRateLimit(key: string, rule: RateLimitRule): boolean {
  const now = Date.now()
  const timestamps = (buckets.get(key) ?? []).filter((ts) => now - ts < rule.windowMs)

  if (timestamps.length >= rule.limit) {
    incrCounter('rateLimitRejected')
    buckets.set(key, timestamps)
    return false
  }

  timestamps.push(now)
  buckets.set(key, timestamps)

  if (buckets.size > BUCKET_PRUNE_THRESHOLD) {
    for (const [bucketKey, ts] of buckets) {
      if (ts.every((t) => now - t >= rule.windowMs)) {
        buckets.delete(bucketKey)
      }
    }
  }

  return true
}
