// In-memory token bucket rate limiter for demo use.
// Replace with @upstash/ratelimit + @vercel/kv for production.

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

interface RateLimitConfig {
  maxTokens: number
  windowMs: number
}

const configs: Record<string, RateLimitConfig> = {
  upload: { maxTokens: 100, windowMs: 10 * 60 * 1000 },
  match: { maxTokens: 100, windowMs: 10 * 60 * 1000 },
}

export function checkRateLimit(
  key: string,
  route: keyof typeof configs
): { allowed: boolean; retryAfterMs: number } {
  const config = configs[route]
  const now = Date.now()
  const bucketKey = `${route}:${key}`

  let bucket = buckets.get(bucketKey)
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now }
    buckets.set(bucketKey, bucket)
  }

  // Refill tokens if window has passed
  if (now - bucket.lastRefill >= config.windowMs) {
    bucket.tokens = config.maxTokens
    bucket.lastRefill = now
  }

  if (bucket.tokens <= 0) {
    const retryAfterMs = config.windowMs - (now - bucket.lastRefill)
    return { allowed: false, retryAfterMs }
  }

  bucket.tokens -= 1
  return { allowed: true, retryAfterMs: 0 }
}
