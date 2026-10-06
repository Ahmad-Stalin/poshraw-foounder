import { createRateLimiter } from './rate-limits.js'
import { reportServerError } from './monitoring.js'

const pageViewCleanupInterval = 256
let pageViewsSinceCleanup = 0

function analyticsOriginGuard(configuredOrigins, isProduction) {
  const allowedOrigins = new Set(configuredOrigins)
  if (!isProduction) {
    allowedOrigins.add('http://localhost:5173')
    allowedOrigins.add('http://127.0.0.1:5173')
    allowedOrigins.add('http://localhost:5174')
    allowedOrigins.add('http://127.0.0.1:5174')
  }

  return (request, response, next) => {
    const origin = request.get('origin')
    const protocol = request.get('x-forwarded-proto')?.split(',')[0] || request.protocol
    if (!origin || (origin !== `${protocol}://${request.get('host')}` && !allowedOrigins.has(origin))) {
      response.status(403).json({ error: 'Request origin is not allowed' })
      return
    }
    next()
  }
}

export function registerAnalyticsRoutes(app, { getDatabase, configuredOrigins = [], isProduction = false }) {
  const checkOrigin = analyticsOriginGuard(configuredOrigins, isProduction)
  const rateLimitPageViews = createRateLimiter(getDatabase, {
    scope: 'storefront-page-views',
    limit: 60,
    windowMs: 15 * 60 * 1000,
    message: 'Too many page views. Try again later.',
  })

  app.post('/api/analytics/page-view', checkOrigin, rateLimitPageViews, async (request, response) => {
    const candidate = request.body?.path
    if (typeof candidate !== 'string' || candidate.length > 500) {
      response.status(400).json({ error: 'Invalid page path' })
      return
    }

    let pagePath
    try {
      const parsed = new URL(candidate, 'https://analytics.invalid')
      if (parsed.origin !== 'https://analytics.invalid' || !parsed.pathname.startsWith('/')) {
        response.status(400).json({ error: 'Invalid page path' })
        return
      }
      pagePath = parsed.pathname.slice(0, 200)
    } catch {
      response.status(400).json({ error: 'Invalid page path' })
      return
    }

    try {
      const database = getDatabase()
      await database.query('INSERT INTO site_page_views (path) VALUES ($1)', [pagePath])
      pageViewsSinceCleanup += 1
      if (pageViewsSinceCleanup >= pageViewCleanupInterval) {
        pageViewsSinceCleanup = 0
        try {
          await database.query("DELETE FROM site_page_views WHERE created_at < now() - interval '90 days'")
        } catch (error) {
          console.error('Old page-view cleanup failed:', error)
          reportServerError(error, 'analytics.cleanup')
        }
      }
      response.status(202).json({ recorded: true })
    } catch (error) {
      console.error('Page view recording failed:', error)
      reportServerError(error, 'analytics.record')
      response.status(500).json({ error: 'Unable to record page view' })
    }
  })
}
