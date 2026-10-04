import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerAdminRoutes } from './admin.js'
import { registerAnalyticsRoutes } from './analytics.js'
import { createEmailNotificationWorker, createEmailTransport } from './email-notifications.js'
import {
  isMetricsAuthorizationValid,
  metricsContentType,
  metricsText,
  recordClientError,
  recordClientErrorRejection,
  recordRequest,
  reportServerError,
} from './monitoring.js'
import { registerOrderRoutes } from './orders.js'
import { createRateLimiter } from './rate-limits.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const databaseDirectory = path.resolve(process.env.POSHRAW_DB_DIR || path.join(projectRoot, 'data', 'poshraw'))
const databaseUrl = process.env.DATABASE_URL || ''
const databaseSsl = process.env.DATABASE_SSL || ''
const port = Number(process.env.API_PORT || 3001)
const host = process.env.API_HOST || '127.0.0.1'
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production')
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || (isProduction ? 1 : 0))
const adminSetupToken = process.env.POSHRAW_ADMIN_SETUP_TOKEN || ''
let metricsBearerToken = process.env.METRICS_BEARER_TOKEN || ''
const metricsBearerTokenFile = process.env.METRICS_BEARER_TOKEN_FILE || ''
const allowedOrigins = (process.env.POSHRAW_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const app = express()

app.disable('x-powered-by')
app.set('trust proxy', trustProxyHops)
if (isProduction) {
  app.use((request, response, next) => {
    const authenticatedMetricsScrape = request.path === '/internal/metrics'
      && isMetricsAuthorizationValid(request.get('authorization'), metricsBearerToken)
    if (!request.secure && !authenticatedMetricsScrape) {
      response.status(426).json({ error: 'HTTPS is required' })
      return
    }
    next()
  })
}
app.use(express.json({ limit: '200kb' }))
app.use((request, response, next) => {
  recordRequest(request, response, performance.now())
  next()
})

let database
let httpServer
let emailNotificationWorker

registerAdminRoutes(app, {
  getDatabase: () => database,
  isProduction,
  setupToken: adminSetupToken,
  configuredOrigins: allowedOrigins,
})
registerOrderRoutes(app, {
  getDatabase: () => database,
  configuredOrigins: allowedOrigins,
  isProduction,
})
registerAnalyticsRoutes(app, {
  getDatabase: () => database,
  configuredOrigins: allowedOrigins,
  isProduction,
})

app.get('/api/health', async (_request, response) => {
  try {
    await database.query('SELECT 1')
    response.json({ status: 'ok' })
  } catch (error) {
    reportServerError(error, 'health.database')
    response.status(503).json({ error: 'Database unavailable' })
  }
})

app.get('/api/health/live', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/internal/metrics', async (request, response) => {
  if (!isMetricsAuthorizationValid(request.get('authorization'), metricsBearerToken)) {
    response.status(404).end()
    return
  }
  try {
    response.set('Content-Type', metricsContentType())
    response.send(await metricsText())
  } catch (error) {
    reportServerError(error, 'health.database')
    response.status(500).end()
  }
})

app.post(
  '/api/monitoring/client-errors',
  createRateLimiter(() => database, {
    scope: 'client-monitoring',
    limit: 20,
    windowMs: 60 * 60 * 1000,
    message: 'Too many error reports. Try again later.',
  }),
  (request, response) => {
    const origin = request.get('origin')
    const trustedOrigin = allowedOrigins.includes(origin)
      || (!isProduction && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin))
    if (!trustedOrigin) {
      recordClientErrorRejection('forbidden')
      response.status(403).json({ error: 'Request origin is not allowed' })
      return
    }
    if (!recordClientError(request.body?.kind)) {
      response.status(400).json({ error: 'Unsupported browser error type' })
      return
    }
    response.status(202).json({ recorded: true })
  },
)

app.get('/api/health/notifications', async (_request, response) => {
  if (!emailNotificationWorker?.configured) {
    response.json({ status: 'disabled' })
    return
  }
  try {
    const result = await database.query(
      `SELECT
         count(*) FILTER (WHERE status = 'pending' AND created_at < now() - interval '15 minutes')::int AS delayed,
         count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '24 hours')::int AS failed
       FROM email_notification_outbox`,
    )
    const { delayed, failed } = result.rows[0]
    if (delayed > 0 || failed > 0) {
      response.status(503).json({ error: 'Notification delivery is delayed' })
      return
    }
    response.json({ status: 'ok' })
  } catch (error) {
    reportServerError(error, 'health.notifications')
    response.status(503).json({ error: 'Notification status unavailable' })
  }
})

app.get('/api/catalog', async (request, response) => {
  const locale = request.query.locale === 'en' ? 'en' : 'ckb'

  try {
    const [stageResult, colorResult, sizeResult, productResult, variantResult, sizeGuideResult, variantImageResult] = await Promise.all([
      database.query(
        'SELECT code, name_en, name_ckb, sort_order FROM school_stages ORDER BY sort_order',
      ),
      database.query(
        'SELECT code, name_en, name_ckb, hex_value, sort_order FROM color_options WHERE is_active ORDER BY sort_order',
      ),
      database.query(
        'SELECT code, label, sort_order FROM sizes WHERE is_active ORDER BY sort_order',
      ),
      database.query(
        `SELECT p.id, p.sku, p.slug, p.stage_code, p.currency, p.price_minor,
                t.name, t.short_description, t.description,
                t.material, t.care_instructions,
                i.image_url, i.alt_text
         FROM products p
         JOIN school_stages st ON st.code = p.stage_code
         JOIN product_translations t ON t.product_id = p.id AND t.locale = $1
         LEFT JOIN product_images i
           ON i.product_id = p.id AND i.image_role = 'card' AND i.sort_order = 1
         WHERE p.status = 'active' AND p.archived_at IS NULL
         ORDER BY st.sort_order, p.sku`,
        [locale],
      ),
      database.query(
        `SELECT v.id, v.product_id, v.variant_sku, v.color_code, v.size_code,
                COALESCE(v.price_minor, p.price_minor) AS price_minor,
                v.currency, v.track_inventory, v.stock_on_hand,
                c.name_en AS color_name_en, c.name_ckb AS color_name_ckb,
                c.hex_value, s.label AS size_label
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         JOIN color_options c ON c.code = v.color_code AND c.is_active
         JOIN sizes s ON s.code = v.size_code AND s.is_active
         WHERE p.status = 'active' AND p.archived_at IS NULL AND v.is_active
         ORDER BY v.product_id, c.sort_order, s.sort_order`,
      ),
      database.query(
        `SELECT stage_code, size_code,
                age_min_months, age_max_months,
                height_min_cm, height_max_cm,
                chest_cm, waist_cm, hip_cm,
                fit_note_en, fit_note_ckb
         FROM size_guide_entries
         ORDER BY stage_code, size_code`,
      ),
      database.query(
        `SELECT vi.id, vi.variant_id, vi.image_url, vi.alt_text, vi.view_label, vi.sort_order
         FROM variant_images vi
         JOIN product_variants pv ON pv.id = vi.variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE p.status = 'active' AND p.archived_at IS NULL
         ORDER BY pv.product_id, pv.color_code, pv.size_code, vi.sort_order`,
      ),
    ])

    const variantsByProduct = new Map()
    const variantImagesByVariant = new Map()
    const sizeGuideByStage = new Map()

    for (const row of variantImageResult.rows) {
      const images = variantImagesByVariant.get(row.variant_id) || []
      images.push({
        id: row.id,
        url: row.image_url,
        altText: row.alt_text,
        viewLabel: row.view_label,
        sortOrder: row.sort_order,
      })
      variantImagesByVariant.set(row.variant_id, images)
    }

    for (const row of sizeGuideResult.rows) {
      const stageEntries = sizeGuideByStage.get(row.stage_code) || {}
      stageEntries[row.size_code] = {
        sizeCode: row.size_code,
        ageRange: row.age_min_months === null && row.age_max_months === null
          ? null
          : `${row.age_min_months ?? '—'}-${row.age_max_months ?? '—'} months`,
        heightRange: row.height_min_cm === null && row.height_max_cm === null
          ? null
          : `${row.height_min_cm ?? '—'}-${row.height_max_cm ?? '—'} cm`,
        chestCm: row.chest_cm,
        waistCm: row.waist_cm,
        hipCm: row.hip_cm,
        fitNote: locale === 'ckb' ? row.fit_note_ckb : row.fit_note_en,
      }
      sizeGuideByStage.set(row.stage_code, stageEntries)
    }

    for (const row of variantResult.rows) {
      const variants = variantsByProduct.get(row.product_id) || []
      const gallery = (variantImagesByVariant.get(row.id) || []).sort((first, second) => first.sortOrder - second.sortOrder)
      variants.push({
        id: row.id,
        sku: row.variant_sku,
        colorCode: row.color_code,
        colorName: locale === 'ckb' ? row.color_name_ckb : row.color_name_en,
        colorHex: row.hex_value,
        sizeCode: row.size_code,
        sizeLabel: row.size_label,
        priceMinor: row.price_minor === null ? null : Number(row.price_minor),
        currency: row.currency.trim(),
        trackInventory: row.track_inventory,
        stockOnHand: row.stock_on_hand,
        isAvailable: !row.track_inventory || row.stock_on_hand > 0,
        gallery,
      })
      variantsByProduct.set(row.product_id, variants)
    }

    response.json({
      locale,
      stages: stageResult.rows.map((row) => ({
        code: row.code,
        name: locale === 'ckb' ? row.name_ckb : row.name_en,
        sortOrder: row.sort_order,
      })),
      colors: colorResult.rows.map((row) => ({
        code: row.code,
        name: locale === 'ckb' ? row.name_ckb : row.name_en,
        hexValue: row.hex_value.trim(),
        sortOrder: row.sort_order,
      })),
      sizes: sizeResult.rows.map((row) => ({
        code: row.code,
        label: row.label,
        sortOrder: row.sort_order,
      })),
      sizeGuide: Object.fromEntries(Array.from(sizeGuideByStage.entries()).map(([stageCode, entries]) => ([stageCode, {
        code: stageCode,
        entries: Object.values(entries).sort((first, second) => {
          const index = { XS: 1, S: 2, M: 3, L: 4, XL: 5 }
          return (index[first.sizeCode] ?? 99) - (index[second.sizeCode] ?? 99)
        }),
      }]))),
      products: productResult.rows.map((row) => {
        const variants = variantsByProduct.get(row.id) || []
        const prices = variants.map((variant) => variant.priceMinor).filter((price) => price !== null)
        return {
          id: row.id,
          sku: row.sku,
          slug: row.slug,
          stageCode: row.stage_code,
          name: row.name,
          shortDescription: row.short_description,
          description: row.description,
          material: row.material,
          careInstructions: row.care_instructions,
          currency: row.currency.trim(),
          priceMinor: row.price_minor === null
            ? prices.length ? Math.min(...prices) : null
            : Number(row.price_minor),
          imageUrl: row.image_url,
          imageAlt: row.alt_text,
          variants,
        }
      }),
    })
  } catch (error) {
    console.error('Catalog request failed:', error)
    reportServerError(error, 'catalog.load')
    response.status(500).json({ error: 'Unable to load the catalog' })
  }
})

if (isProduction) {
  const distributionDirectory = path.join(projectRoot, 'dist')
  app.use(express.static(distributionDirectory))
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distributionDirectory, 'index.html'))
  })
}

app.use((error, _request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }
  console.error('Unhandled API request error:', error)
  reportServerError(error, 'http.unhandled')
  response.status(500).json({ error: 'Internal server error' })
})

async function start() {
  if (metricsBearerTokenFile) {
    metricsBearerToken = (await readFile(metricsBearerTokenFile, 'utf8')).trim()
  }
  if (metricsBearerToken && metricsBearerToken.length < 32) {
    throw new Error('METRICS_BEARER_TOKEN must be at least 32 characters.')
  }

  if (isProduction) {
    if (!databaseUrl) throw new Error('DATABASE_URL is required in production; local PGlite is development-only.')
    if (allowedOrigins.length === 0 || allowedOrigins.some((origin) => !origin.startsWith('https://'))) {
      throw new Error('POSHRAW_ALLOWED_ORIGINS must contain trusted HTTPS storefront origins in production.')
    }
    if (adminSetupToken && Buffer.byteLength(adminSetupToken) < 32) {
      throw new Error('POSHRAW_ADMIN_SETUP_TOKEN must be at least 32 bytes.')
    }
  }

  console.log(`Prometheus metrics: ${metricsBearerToken ? 'enabled at /internal/metrics' : 'disabled; set METRICS_BEARER_TOKEN to enable'}`)
  const emailTransport = createEmailTransport()

  if (databaseUrl) {
    const connectionUrl = new URL(databaseUrl)
    connectionUrl.searchParams.delete('sslmode')
    const pool = new pg.Pool({
      connectionString: connectionUrl.toString(),
      max: Number(process.env.DATABASE_POOL_SIZE || 10),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ssl: isProduction || databaseSsl === 'require'
        ? { rejectUnauthorized: true }
        : databaseSsl === 'disable' ? false : undefined,
    })
    database = {
      query: (...args) => pool.query(...args),
      transaction: async (operation) => {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await operation(client)
          await client.query('COMMIT')
          return result
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined)
          throw error
        } finally {
          client.release()
        }
      },
      close: () => pool.end(),
      kind: 'managed PostgreSQL',
    }
    await database.query('SELECT 1')
  } else {
    if (isProduction) throw new Error('Production must use managed PostgreSQL; PGlite is development-only.')
    await mkdir(databaseDirectory, { recursive: true })
    const pglite = new PGlite(databaseDirectory)
    database = {
      query: (...args) => pglite.query(...args),
      exec: (sql) => pglite.exec(sql),
      close: () => pglite.close(),
      kind: 'local PGlite',
    }
  }

  const schemaSql = await readFile(path.join(projectRoot, 'database', 'schema.sql'), 'utf8')
  if (database.exec) await database.exec(schemaSql)
  else await database.query(schemaSql)

  const productCount = await database.query('SELECT count(*)::int AS count FROM products')
  if (productCount.rows[0].count === 0 && !isProduction) {
    const seedSql = await readFile(path.join(projectRoot, 'database', 'seed.sql'), 'utf8')
    if (database.exec) await database.exec(seedSql)
    else await database.query(seedSql)
  }

  if (isProduction) {
    const admins = await database.query('SELECT count(*)::int AS count FROM admin_users')
    if (admins.rows[0].count === 0 && !adminSetupToken) {
      throw new Error('No admin exists. Configure a unique POSHRAW_ADMIN_SETUP_TOKEN for the first secure setup.')
    }
  }

  emailNotificationWorker = createEmailNotificationWorker({
    getDatabase: () => database,
    transport: emailTransport,
  })
  emailNotificationWorker.start()
  if (!emailNotificationWorker.configured) {
    console.log('Order email notifications: queued until SMTP_HOST and SMTP_FROM are configured')
  } else {
    console.log('Order email notifications: enabled')
  }

  httpServer = app.listen(port, host, () => {
    console.log(`POSHRAW catalog API listening on http://${host}:${port}`)
    console.log(`Database backend: ${database.kind}${databaseUrl ? ' (connection details hidden)' : ` (${databaseDirectory})`}`)
    console.log(`HTTPS proxy mode: ${isProduction ? `required (${trustProxyHops} trusted proxy hop${trustProxyHops === 1 ? '' : 's'})` : 'development'}`)
    console.log(`Admin bootstrap: ${adminSetupToken ? 'enabled until first admin is created' : 'disabled; set POSHRAW_ADMIN_SETUP_TOKEN to enable'}`)
  })
}

async function stop() {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve))
  if (emailNotificationWorker) await emailNotificationWorker.stop()
  if (database) await database.close()
  process.exit(0)
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)

start().catch((error) => {
  console.error('Unable to start POSHRAW API:', error)
  reportServerError(error, 'application.startup')
  process.exitCode = 1
})