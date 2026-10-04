import { createHash } from 'node:crypto'

const cleanupInterval = 256
let requestsSinceCleanup = 0

export function createRateLimiter(getDatabase, { scope, limit, windowMs, message }) {
  return async (request, response, next) => {
    try {
      const database = getDatabase()
      const now = new Date()
      const resetAt = new Date(now.getTime() + windowMs)
      const bucketHash = createHash('sha256')
        .update(`${scope}:${request.path}:${request.ip || 'unknown'}`)
        .digest('hex')
      const result = await database.query(
        `INSERT INTO api_rate_limit_windows AS stored (bucket_hash, request_count, reset_at)
         VALUES ($1, 1, $3::timestamptz)
         ON CONFLICT (bucket_hash) DO UPDATE SET
           request_count = CASE WHEN stored.reset_at <= $2::timestamptz THEN 1 ELSE stored.request_count + 1 END,
           reset_at = CASE WHEN stored.reset_at <= $2::timestamptz THEN EXCLUDED.reset_at ELSE stored.reset_at END
         RETURNING request_count, reset_at`,
        [bucketHash, now.toISOString(), resetAt.toISOString()],
      )

      requestsSinceCleanup += 1
      if (requestsSinceCleanup >= cleanupInterval) {
        requestsSinceCleanup = 0
        await database.query('DELETE FROM api_rate_limit_windows WHERE reset_at <= $1', [now.toISOString()])
      }

      const bucket = result.rows[0]
      if (bucket.request_count > limit) {
        const retryAfter = Math.max(1, Math.ceil((new Date(bucket.reset_at).getTime() - now.getTime()) / 1000))
        response.set('Retry-After', String(retryAfter))
        response.status(429).json({ error: message })
        return
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}