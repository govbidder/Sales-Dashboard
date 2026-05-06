/**
 * In-memory token-bucket rate limiter.
 *
 * Caveats:
 * - Resets when serverless functions cold-start. OK for spam stopping
 *   (an attacker would need to hit hard enough that warm instances
 *   keep the bucket alive).
 * - Per-instance, not global across replicas. For real abuse defense,
 *   migrate to Upstash Redis or a DB-backed counter.
 *
 * Usage:
 *   const limit = await rateLimit({ key: "forms:" + ip, limit: 5, windowMs: 3600_000 })
 *   if (!limit.allowed) return 429 with limit.retryAfterMs
 */

interface Bucket {
  count:     number
  expiresAt: number
}

const buckets = new Map<string, Bucket>()

// Periodic cleanup so the map doesn't grow unbounded (every 5 min)
let lastCleanup = Date.now()
function cleanupIfNeeded() {
  const now = Date.now()
  if (now - lastCleanup < 5 * 60_000) return
  lastCleanup = now
  for (const [key, b] of buckets.entries()) {
    if (b.expiresAt < now) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  key:      string
  limit:    number
  windowMs: number
}

export interface RateLimitResult {
  allowed:        boolean
  count:          number
  limit:          number
  remaining:      number
  retryAfterMs:   number
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  cleanupIfNeeded()

  const now = Date.now()
  const existing = buckets.get(opts.key)

  if (!existing || existing.expiresAt < now) {
    buckets.set(opts.key, { count: 1, expiresAt: now + opts.windowMs })
    return {
      allowed:      true,
      count:        1,
      limit:        opts.limit,
      remaining:    opts.limit - 1,
      retryAfterMs: 0,
    }
  }

  existing.count += 1
  if (existing.count > opts.limit) {
    return {
      allowed:      false,
      count:        existing.count,
      limit:        opts.limit,
      remaining:    0,
      retryAfterMs: existing.expiresAt - now,
    }
  }

  return {
    allowed:      true,
    count:        existing.count,
    limit:        opts.limit,
    remaining:    opts.limit - existing.count,
    retryAfterMs: 0,
  }
}
