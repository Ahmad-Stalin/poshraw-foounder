import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createRateLimiter } from './rate-limits.js'
import { withWriteTransaction } from './transactions.js'
import { queueOrderEmail } from './email-notifications.js'
import { reportServerError } from './monitoring.js'

const scrypt = promisify(scryptCallback)
const sessionCookieName = 'poshraw_admin'
const sessionDurationMs = 8 * 60 * 60 * 1000
const allowedOrderStatuses = new Set(['pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'])
const orderStatusTransitions = {
  pending: new Set(['confirmed', 'processing', 'ready', 'completed', 'cancelled']),
  confirmed: new Set(['processing', 'ready', 'completed', 'cancelled']),
  processing: new Set(['ready', 'completed', 'cancelled']),
  ready: new Set(['completed', 'cancelled']),
  completed: new Set(),
  cancelled: new Set(),
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function readCookie(request, name) {
  for (const part of (request.get('cookie') || '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim())
    }
  }
  return null
}

function normalizedEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function parseMinorAmount(value) {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || value < 0) return undefined
  return value
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function containsControlCharacters(value) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint <= 31 || codePoint === 127
  })
}

function csvCell(value) {
  const text = String(value ?? '')
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

function safeBootstrapToken(candidate, configured) {
  if (typeof candidate !== 'string' || !configured) return false
  return timingSafeEqual(
    Buffer.from(hashToken(candidate), 'hex'),
    Buffer.from(hashToken(configured), 'hex'),
  )
}

function originGuard(allowedOrigins) {
  return (request, response, next) => {
    const origin = request.get('origin')
    const protocol = request.get('x-forwarded-proto')?.split(',')[0] || request.protocol
    const sameOrigin = origin && origin === `${protocol}://${request.get('host')}`
    if (!origin || (!sameOrigin && !allowedOrigins.has(origin))) {
      response.status(403).json({ error: 'Request origin is not allowed' })
      return
    }
    next()
  }
}

async function makePasswordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const digest = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${digest.toString('hex')}`
}

async function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedDigest] = (passwordHash || '').split('$')
  if (algorithm !== 'scrypt' || !salt || !storedDigest) return false

  const expected = Buffer.from(storedDigest, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function setSessionCookie(response, token, isProduction) {
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: sessionDurationMs,
  })
}

function clearSessionCookie(response, isProduction) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/admin',
  })
}

async function createSession(database, adminUserId, response, isProduction) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionDurationMs)
  await database.query(
    'INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [adminUserId, hashToken(token), expiresAt],
  )
  setSessionCookie(response, token, isProduction)
}

function makeAdminGuard(getDatabase, isProduction) {
  return async (request, response, next) => {
    try {
      const token = readCookie(request, sessionCookieName)
      if (!token) {
        response.status(401).json({ error: 'Authentication required' })
        return
      }

      const result = await getDatabase().query(
        `SELECT u.id, u.email
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.admin_user_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
        [hashToken(token)],
      )
      if (!result.rows[0]) {
        clearSessionCookie(response, isProduction)
        response.status(401).json({ error: 'Session expired' })
        return
      }

      request.adminUser = result.rows[0]
      next()
    } catch (error) {
      next(error)
    }
  }
}

function buildAdminProducts(database) {
  return Promise.all([
    database.query(
      `SELECT p.id, p.sku, p.slug, p.stage_code, p.status, p.currency,
              p.price_minor, p.created_at, p.updated_at
       FROM products p
       JOIN school_stages st ON st.code = p.stage_code
       ORDER BY st.sort_order, p.sku`,
    ),
    database.query(
      `SELECT product_id, locale, name, short_description, description, material, care_instructions
       FROM product_translations ORDER BY locale`,
    ),
    database.query(
      `SELECT id, product_id, image_url, alt_text, image_role, sort_order
       FROM product_images ORDER BY product_id, image_role, sort_order`,
    ),
    database.query(
      `SELECT v.id, v.product_id, v.variant_sku, v.color_code, v.size_code,
              v.price_minor, v.currency, v.track_inventory, v.stock_on_hand,
              v.low_stock_threshold, v.is_active,
              c.name_en AS color_name_en, c.name_ckb AS color_name_ckb, c.hex_value,
              s.label AS size_label
       FROM product_variants v
       JOIN color_options c ON c.code = v.color_code
       JOIN sizes s ON s.code = v.size_code
       ORDER BY v.product_id, c.sort_order, s.sort_order`,
    ),
  ]).then(([productsResult, translationsResult, imagesResult, variantsResult]) => {
    const translations = new Map()
    const images = new Map()
    const variants = new Map()

    for (const row of translationsResult.rows) {
      const productTranslations = translations.get(row.product_id) || {}
      productTranslations[row.locale] = {
        name: row.name,
        shortDescription: row.short_description,
        description: row.description,
        material: row.material,
        careInstructions: row.care_instructions,
      }
      translations.set(row.product_id, productTranslations)
    }
    for (const row of imagesResult.rows) {
      const productImages = images.get(row.product_id) || []
      productImages.push({
        id: row.id,
        url: row.image_url,
        altText: row.alt_text,
        role: row.image_role,
        sortOrder: row.sort_order,
      })
      images.set(row.product_id, productImages)
    }
    for (const row of variantsResult.rows) {
      const productVariants = variants.get(row.product_id) || []
      productVariants.push({
        id: row.id,
        sku: row.variant_sku,
        colorCode: row.color_code,
        colorNameEn: row.color_name_en,
        colorNameCkb: row.color_name_ckb,
        colorHex: row.hex_value.trim(),
        sizeCode: row.size_code,
        sizeLabel: row.size_label,
        priceMinor: row.price_minor === null ? null : Number(row.price_minor),
        currency: row.currency.trim(),
        trackInventory: row.track_inventory,
        stockOnHand: row.stock_on_hand,
        lowStockThreshold: row.low_stock_threshold,
        isActive: row.is_active,
      })
      variants.set(row.product_id, productVariants)
    }

    return productsResult.rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      stageCode: row.stage_code,
      status: row.status,
      currency: row.currency.trim(),
      priceMinor: row.price_minor === null ? null : Number(row.price_minor),
      translations: translations.get(row.id) || {},
      images: images.get(row.id) || [],
      variants: variants.get(row.id) || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  })
}

export function registerAdminRoutes(app, {
  getDatabase,
  isProduction,
  setupToken,
  configuredOrigins = [],
}) {
  const allowedOrigins = new Set(configuredOrigins)
  if (!isProduction) {
    allowedOrigins.add('http://localhost:5173')
    allowedOrigins.add('http://127.0.0.1:5173')
  }
  const checkOrigin = originGuard(allowedOrigins)
  const requireAdmin = makeAdminGuard(getDatabase, isProduction)
  const rateLimitAuth = createRateLimiter(getDatabase, {
    scope: 'admin-auth',
    limit: 8,
    windowMs: 15 * 60 * 1000,
    message: 'Too many attempts. Try again later.',
  })

  app.get('/api/admin/setup-status', async (_request, response) => {
    try {
      const result = await getDatabase().query('SELECT count(*)::int AS count FROM admin_users')
      response.json({
        setupRequired: result.rows[0].count === 0,
        setupEnabled: Boolean(setupToken),
      })
    } catch (error) {
      console.error('Admin setup status failed:', error)
      reportServerError(error, 'admin.setup_status')
      response.status(500).json({ error: 'Unable to check admin setup' })
    }
  })

  app.get('/api/admin/session', async (request, response) => {
    try {
      const token = readCookie(request, sessionCookieName)
      if (!token) {
        response.json({ admin: null })
        return
      }
      const result = await getDatabase().query(
        `SELECT u.id, u.email
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.admin_user_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
        [hashToken(token)],
      )
      response.json({ admin: result.rows[0] || null })
    } catch (error) {
      console.error('Admin session check failed:', error)
      reportServerError(error, 'admin.session')
      response.status(500).json({ error: 'Unable to check admin session' })
    }
  })

  app.post('/api/admin/setup', checkOrigin, rateLimitAuth, async (request, response) => {
    if (!setupToken) {
      response.status(503).json({ error: 'Admin setup is disabled. Configure POSHRAW_ADMIN_SETUP_TOKEN first.' })
      return
    }
    if (!safeBootstrapToken(request.body?.setupToken, setupToken)) {
      response.status(403).json({ error: 'Invalid setup token' })
      return
    }
    const email = normalizedEmail(request.body?.email)
    const password = request.body?.password
    if (!email || typeof password !== 'string' || password.length < 12 || password.length > 128) {
      response.status(400).json({ error: 'Enter a valid email and a password of at least 12 characters' })
      return
    }

    try {
      const database = getDatabase()
      const admin = await withWriteTransaction(database, async (transaction) => {
        const claim = await transaction.query(
          `UPDATE admin_setup_state
           SET setup_complete = true
           WHERE setup_id = 1 AND setup_complete = false
           RETURNING setup_id`,
        )
        if (!claim.rows[0]) return null

        const existing = await transaction.query('SELECT count(*)::int AS count FROM admin_users')
        if (existing.rows[0].count > 0) return null
        const passwordHash = await makePasswordHash(password)
        const created = await transaction.query(
          'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
          [email, passwordHash],
        )
        return created.rows[0]
      })
      if (!admin) {
        response.status(409).json({ error: 'Admin setup has already been completed' })
        return
      }
      await createSession(database, admin.id, response, isProduction)
      response.status(201).json({ admin })
    } catch (error) {
      console.error('Admin setup failed:', error)
      reportServerError(error, 'admin.setup')
      response.status(500).json({ error: 'Unable to create admin account' })
    }
  })

  app.post('/api/admin/login', checkOrigin, rateLimitAuth, async (request, response) => {
    const email = normalizedEmail(request.body?.email)
    const password = request.body?.password
    if (!email || typeof password !== 'string' || password.length > 128) {
      response.status(400).json({ error: 'Invalid email or password' })
      return
    }

    try {
      const database = getDatabase()
      const result = await database.query(
        'SELECT id, email, password_hash FROM admin_users WHERE email = $1',
        [email],
      )
      const admin = result.rows[0]
      if (!admin || !(await verifyPassword(password, admin.password_hash))) {
        response.status(401).json({ error: 'Invalid email or password' })
        return
      }
      await database.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [admin.id])
      await database.query('DELETE FROM admin_sessions WHERE expires_at <= now() OR revoked_at IS NOT NULL')
      await createSession(database, admin.id, response, isProduction)
      response.json({ admin: { id: admin.id, email: admin.email } })
    } catch (error) {
      console.error('Admin login failed:', error)
      reportServerError(error, 'admin.login')
      response.status(500).json({ error: 'Unable to sign in' })
    }
  })

  app.post('/api/admin/logout', checkOrigin, async (request, response) => {
    const token = readCookie(request, sessionCookieName)
    if (token) {
      try {
        await getDatabase().query(
          'UPDATE admin_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
          [hashToken(token)],
        )
      } catch (error) {
        console.error('Admin logout failed:', error)
        reportServerError(error, 'admin.logout')
      }
    }
    clearSessionCookie(response, isProduction)
    response.json({ admin: null })
  })

  app.get('/api/admin/products', requireAdmin, async (_request, response) => {
    try {
      const database = getDatabase()
      const [products, stagesResult] = await Promise.all([
        buildAdminProducts(database),
        database.query('SELECT code, name_en, name_ckb, sort_order FROM school_stages ORDER BY sort_order'),
      ])
      response.json({
        products,
        stages: stagesResult.rows.map((stage) => ({
          code: stage.code,
          nameEn: stage.name_en,
          nameCkb: stage.name_ckb,
          sortOrder: stage.sort_order,
        })),
      })
    } catch (error) {
      console.error('Admin products request failed:', error)
      reportServerError(error, 'admin.products')
      response.status(500).json({ error: 'Unable to load products' })
    }
  })

  app.put('/api/admin/products/:id', checkOrigin, requireAdmin, async (request, response) => {
    const { stageCode, status, translations } = request.body || {}
    const priceMinor = parseMinorAmount(request.body?.priceMinor)
    if (!stageCode || !['draft', 'active', 'archived'].includes(status) || priceMinor === undefined) {
      response.status(400).json({ error: 'Invalid product fields' })
      return
    }
    for (const locale of ['en', 'ckb']) {
      const translation = translations?.[locale]
      if (!translation || typeof translation.name !== 'string' || !translation.name.trim()) {
        response.status(400).json({ error: 'Both English and Sorani product names are required' })
        return
      }
    }

    try {
      const database = getDatabase()
      const updated = await withWriteTransaction(database, async (transaction) => {
        const result = await transaction.query(
          `UPDATE products
           SET stage_code = $1, status = $2, price_minor = $3,
               archived_at = CASE WHEN $2 = 'archived' THEN COALESCE(archived_at, now()) ELSE NULL END
           WHERE id = $4 RETURNING id`,
          [stageCode, status, priceMinor, request.params.id],
        )
        if (!result.rows[0]) return false
        for (const locale of ['en', 'ckb']) {
          const translation = translations[locale]
          await transaction.query(
            `INSERT INTO product_translations
               (product_id, locale, name, short_description, description, material, care_instructions)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (product_id, locale) DO UPDATE SET
               name = EXCLUDED.name,
               short_description = EXCLUDED.short_description,
               description = EXCLUDED.description,
               material = EXCLUDED.material,
               care_instructions = EXCLUDED.care_instructions`,
            [
              request.params.id,
              locale,
              translation.name.trim(),
              String(translation.shortDescription || ''),
              String(translation.description || ''),
              translation.material ? String(translation.material) : null,
              translation.careInstructions ? String(translation.careInstructions) : null,
            ],
          )
        }
        return true
      })
      if (!updated) {
        response.status(404).json({ error: 'Product not found' })
        return
      }
      response.json({ product: (await buildAdminProducts(database)).find((product) => product.id === request.params.id) })
    } catch (error) {
      console.error('Admin product update failed:', error)
      reportServerError(error, 'admin.product_update')
      response.status(400).json({ error: 'Unable to update product' })
    }
  })

  app.put('/api/admin/products/:id/images', checkOrigin, requireAdmin, async (request, response) => {
    const images = request.body?.images
    if (!Array.isArray(images) || images.length > 12 || images.some((image) => {
      if (typeof image?.url !== 'string' || typeof image?.altText !== 'string') return true
      try {
        return new URL(image.url).protocol !== 'https:' || image.altText.trim().length === 0
      } catch {
        return true
      }
    })) {
      response.status(400).json({ error: 'Provide up to 12 valid HTTPS image URLs with alt text' })
      return
    }

    try {
      const database = getDatabase()
      const product = await database.query('SELECT id FROM products WHERE id = $1', [request.params.id])
      if (!product.rows[0]) {
        response.status(404).json({ error: 'Product not found' })
        return
      }
      await withWriteTransaction(database, async (transaction) => {
        await transaction.query('DELETE FROM product_images WHERE product_id = $1', [request.params.id])
        for (const [index, image] of images.entries()) {
          await transaction.query(
            `INSERT INTO product_images (product_id, image_url, alt_text, image_role, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [request.params.id, image.url, image.altText.trim(), index === 0 ? 'card' : 'gallery', index + 1],
          )
        }
      })
      response.json({ images })
    } catch (error) {
      console.error('Admin image update failed:', error)
      reportServerError(error, 'admin.image_update')
      response.status(400).json({ error: 'Unable to update product photos' })
    }
  })

  app.patch('/api/admin/variants/:id', checkOrigin, requireAdmin, async (request, response) => {
    const { trackInventory, stockOnHand } = request.body || {}
    const priceMinor = request.body?.priceMinor === undefined ? undefined : parseMinorAmount(request.body.priceMinor)
    if (typeof trackInventory !== 'boolean' || priceMinor === undefined) {
      response.status(400).json({ error: 'Invalid variant fields' })
      return
    }
    if (trackInventory && (!Number.isSafeInteger(stockOnHand) || stockOnHand < 0)) {
      response.status(400).json({ error: 'Tracked stock must be a non-negative integer' })
      return
    }

    try {
      const database = getDatabase()
      const result = await withWriteTransaction(database, async (transaction) => {
        const currentResult = await transaction.query(
          'SELECT id, track_inventory, stock_on_hand FROM product_variants WHERE id = $1 FOR UPDATE',
          [request.params.id],
        )
        const current = currentResult.rows[0]
        if (!current) return null

        const nextStock = trackInventory ? stockOnHand : null
        const updated = await transaction.query(
          `UPDATE product_variants
           SET price_minor = $1, track_inventory = $2, stock_on_hand = $3
           WHERE id = $4
           RETURNING id, variant_sku, price_minor, track_inventory, stock_on_hand`,
          [priceMinor, trackInventory, nextStock, request.params.id],
        )

        const previousTrackedStock = current.track_inventory ? current.stock_on_hand : 0
        const nextTrackedStock = trackInventory ? nextStock : 0
        const quantityDelta = nextTrackedStock - previousTrackedStock
        if (quantityDelta !== 0) {
          await transaction.query(
            `INSERT INTO inventory_movements (variant_id, movement_type, quantity_delta, note)
             VALUES ($1, 'adjustment', $2, $3)`,
            [request.params.id, quantityDelta, 'Admin inventory adjustment'],
          )
        }
        return updated.rows[0]
      })
      if (!result) {
        response.status(404).json({ error: 'Variant not found' })
        return
      }
      response.json({
        variant: {
          ...result,
          priceMinor: result.price_minor === null ? null : Number(result.price_minor),
          trackInventory: result.track_inventory,
          stockOnHand: result.stock_on_hand,
        },
      })
    } catch (error) {
      console.error('Admin variant update failed:', error)
      reportServerError(error, 'admin.variant_update')
      response.status(400).json({ error: 'Unable to update price or inventory' })
    }
  })

  app.get('/api/admin/orders', requireAdmin, async (_request, response) => {
    try {
      const database = getDatabase()
      const ordersResult = await database.query(
        `SELECT o.id, o.order_number, o.source, o.status, o.payment_status, o.currency,
          o.subtotal_minor, o.delivery_minor, o.total_minor, o.fulfillment_method,
          o.delivery_address_snapshot, o.customer_name_snapshot, o.privacy_consent_at,
          o.customer_phone_snapshot, o.customer_note, o.staff_note, o.placed_at,
          (SELECT ae.payment_method FROM accounting_entries ae
           WHERE ae.order_id = o.id AND ae.entry_type = 'sale'
           ORDER BY ae.created_at DESC LIMIT 1) AS payment_method,
          COALESCE((SELECT SUM(CASE WHEN p.refund_of_payment_id IS NULL THEN p.amount_minor ELSE -p.amount_minor END)
                    FROM payments p WHERE p.order_id = o.id
                      AND p.status IN ('succeeded', 'partial_refunded', 'refunded')), 0)::bigint AS net_paid_minor,
          COALESCE((SELECT SUM(p.amount_minor) FROM payments p
                    WHERE p.order_id = o.id AND p.refund_of_payment_id IS NULL
                      AND p.status IN ('succeeded', 'partial_refunded', 'refunded')), 0)::bigint AS gross_paid_minor
         FROM orders o ORDER BY o.placed_at DESC LIMIT 200`,
      )
      const orderIds = ordersResult.rows.map((order) => order.id)
      const itemsResult = orderIds.length
        ? await database.query(
          `SELECT order_id, product_name_snapshot, color_name_snapshot,
                  size_label_snapshot, quantity, unit_price_minor, currency
           FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY created_at`,
          [orderIds],
        )
        : { rows: [] }
      const itemsByOrder = new Map()
      for (const item of itemsResult.rows) {
        const items = itemsByOrder.get(item.order_id) || []
        items.push(item)
        itemsByOrder.set(item.order_id, items)
      }
      response.json({
        orders: ordersResult.rows.map((order) => ({
          ...order,
          subtotalMinor: order.subtotal_minor === null ? null : Number(order.subtotal_minor),
          deliveryMinor: order.delivery_minor === null ? null : Number(order.delivery_minor),
          totalMinor: order.total_minor === null ? null : Number(order.total_minor),
          paidMinor: Number(order.net_paid_minor),
          refundableMinor: Number(order.gross_paid_minor) - Number(order.net_paid_minor),
          remainingMinor: order.total_minor === null
            ? null
            : Math.max(0, Number(order.total_minor) - Number(order.net_paid_minor)),
          items: itemsByOrder.get(order.id) || [],
        })),
      })
    } catch (error) {
      console.error('Admin orders request failed:', error)
      reportServerError(error, 'admin.orders')
      response.status(500).json({ error: 'Unable to load orders' })
    }
  })

  app.patch('/api/admin/orders/:id/status', checkOrigin, requireAdmin, async (request, response) => {
    const newStatus = request.body?.status
    if (!allowedOrderStatuses.has(newStatus)) {
      response.status(400).json({ error: 'Invalid order status' })
      return
    }

    try {
      const database = getDatabase()
      const updated = await withWriteTransaction(database, async (transaction) => {
        const currentResult = await transaction.query(
          `SELECT o.id, o.status, o.order_number, c.email, c.preferred_locale
           FROM orders o
           LEFT JOIN customers c ON c.id = o.customer_id
           WHERE o.id = $1 FOR UPDATE OF o`,
          [request.params.id],
        )
        const current = currentResult.rows[0]
        if (!current) return null
        if (current.status === newStatus) return current
        if (!orderStatusTransitions[current.status]?.has(newStatus)) {
          const error = new Error(`Cannot move an order from ${current.status} to ${newStatus}.`)
          error.status = 409
          throw error
        }

        if (newStatus === 'cancelled') {
          const reservations = await transaction.query(
            `SELECT variant_id,
                    SUM(CASE WHEN movement_type = 'reservation' THEN -quantity_delta ELSE 0 END)::int AS reserved,
                    SUM(CASE WHEN movement_type = 'release' THEN quantity_delta ELSE 0 END)::int AS released
             FROM inventory_movements
             WHERE order_id = $1 AND movement_type IN ('reservation', 'release')
             GROUP BY variant_id`,
            [request.params.id],
          )
          for (const reservation of reservations.rows) {
            const remaining = reservation.reserved - reservation.released
            if (remaining <= 0) continue
            const variantResult = await transaction.query(
              'SELECT track_inventory FROM product_variants WHERE id = $1 FOR UPDATE',
              [reservation.variant_id],
            )
            if (variantResult.rows[0]?.track_inventory) {
              await transaction.query(
                'UPDATE product_variants SET stock_on_hand = stock_on_hand + $1 WHERE id = $2',
                [remaining, reservation.variant_id],
              )
            }
            await transaction.query(
              `INSERT INTO inventory_movements (variant_id, order_id, movement_type, quantity_delta, note)
               VALUES ($1, $2, 'release', $3, $4)`,
              [reservation.variant_id, request.params.id, remaining, 'Released after order cancellation'],
            )
          }
        }

        await transaction.query(
          `UPDATE orders SET status = $1,
             completed_at = CASE WHEN $1 = 'completed' THEN COALESCE(completed_at, now()) ELSE NULL END
           WHERE id = $2`,
          [newStatus, request.params.id],
        )
        const statusEvent = await transaction.query(
          `INSERT INTO order_status_events
             (order_id, actor_admin_id, previous_status, new_status, actor_type)
           VALUES ($1, $2, $3, $4, 'staff')
           RETURNING id`,
          [request.params.id, request.adminUser.id, current.status, newStatus],
        )
        if (current.email) {
          await queueOrderEmail(transaction, {
            orderId: current.id,
            statusEventId: statusEvent.rows[0].id,
            recipientEmail: current.email,
            locale: current.preferred_locale,
            notificationType: 'order_status',
            payload: { orderNumber: current.order_number, status: newStatus },
          })
        }
        return { id: current.id, status: newStatus }
      })
      if (!updated) {
        response.status(404).json({ error: 'Order not found' })
        return
      }
      response.json({ order: updated })
    } catch (error) {
      console.error('Admin order status update failed:', error)
      reportServerError(error, 'admin.order_status_update')
      response.status(error.status || 400).json({ error: error.status ? error.message : 'Unable to update order status' })
    }
  })

  app.post('/api/admin/orders/:id/payment', checkOrigin, requireAdmin, async (request, response) => {
    const { amountMinor, finalTotalMinor, paymentMethod } = request.body || {}
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || !['cash', 'bank_transfer'].includes(paymentMethod)) {
      response.status(400).json({ error: 'Enter a valid payment amount and payment method.' })
      return
    }

    try {
      const result = await withWriteTransaction(getDatabase(), async (transaction) => {
        const orderResult = await transaction.query(
          `SELECT id, order_number, status, payment_status, currency,
                  subtotal_minor, total_minor, fulfillment_method
           FROM orders WHERE id = $1 FOR UPDATE`,
          [request.params.id],
        )
        const order = orderResult.rows[0]
        if (!order) return { error: 'Order not found', status: 404 }
        if (order.currency.trim() !== 'IQD') {
          return { error: 'Store accounting currently supports IQD orders only.', status: 409 }
        }
        if (order.status === 'cancelled') return { error: 'Cancelled orders cannot be recorded as paid.', status: 409 }
        if (order.payment_status === 'paid') return { error: 'This order has already been recorded as paid.', status: 409 }
        if (!['unpaid', 'pending', 'partially_paid', 'partially_refunded'].includes(order.payment_status)) {
          return { error: 'This order cannot be recorded as paid in its current payment status.', status: 409 }
        }
        if (order.subtotal_minor === null) {
          return { error: 'Set prices for every item before recording payment.', status: 409 }
        }

        const subtotalMinor = Number(order.subtotal_minor)
        const totalMinor = finalTotalMinor ?? (order.total_minor === null ? null : Number(order.total_minor))
        if (!Number.isSafeInteger(totalMinor) || totalMinor < subtotalMinor) {
          return { error: 'Enter a valid final total that covers the item subtotal.', status: 400 }
        }
        if (order.fulfillment_method === 'pickup' && totalMinor !== subtotalMinor) {
          return { error: 'Pickup final total must match the item subtotal.', status: 400 }
        }
        const deliveryMinor = totalMinor - subtotalMinor
        const existingPayments = await transaction.query(
          `SELECT COALESCE(SUM(
                    CASE WHEN refund_of_payment_id IS NULL THEN amount_minor ELSE -amount_minor END
                  ), 0)::bigint AS net_received
           FROM payments
           WHERE order_id = $1 AND status IN ('succeeded', 'partial_refunded', 'refunded')`,
          [order.id],
        )
        const netReceived = Number(existingPayments.rows[0].net_received)
        if (amountMinor > totalMinor - netReceived) {
          return { error: 'Payment exceeds the remaining amount due.', status: 400 }
        }
        if (totalMinor < netReceived + amountMinor) {
          return { error: 'Final total cannot be less than the amount already received.', status: 400 }
        }
        const payment = await transaction.query(
          `INSERT INTO payments
             (order_id, provider, idempotency_key, status, amount_minor, currency, payment_method, paid_at)
           VALUES ($1, 'manual', $2, 'succeeded', $3, $4, $5, now())
           RETURNING id`,
          [order.id, `manual-order-payment:${order.id}:${randomBytes(12).toString('hex')}`, amountMinor, order.currency, paymentMethod],
        )
        await transaction.query(
          `UPDATE orders
           SET delivery_minor = $1, total_minor = $2,
               payment_status = CASE WHEN $3::bigint >= $2::bigint THEN 'paid' ELSE 'partially_paid' END
           WHERE id = $4`,
          [deliveryMinor, totalMinor, netReceived + amountMinor, order.id],
        )
        await transaction.query(
          `INSERT INTO accounting_entries
             (entry_type, payment_method, category, description,
              amount_minor, currency, order_id, payment_id, recorded_by)
           VALUES ('sale', $1, 'Order sale', $2, $3, $4, $5, $6, $7)`,
          [
            paymentMethod,
            `Payment for order ${order.order_number}`,
            amountMinor,
            order.currency,
            order.id,
            payment.rows[0].id,
            request.adminUser.id,
          ],
        )
        return {
          paymentId: payment.rows[0].id,
          orderId: order.id,
          paymentStatus: netReceived + amountMinor >= totalMinor ? 'paid' : 'partially_paid',
          amountMinor,
          currency: order.currency.trim(),
          deliveryMinor,
          remainingMinor: Math.max(0, totalMinor - netReceived - amountMinor),
        }
      })
      if (result.error) {
        response.status(result.status).json({ error: result.error })
        return
      }
      response.status(201).json({ payment: result })
    } catch (error) {
      console.error('Accounting order payment failed:', error)
      reportServerError(error, 'accounting.order_payment')
      response.status(500).json({ error: 'Unable to record payment' })
    }
  })

  app.post('/api/admin/orders/:id/refund', checkOrigin, requireAdmin, async (request, response) => {
    const { amountMinor, paymentMethod } = request.body || {}
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || !['cash', 'bank_transfer'].includes(paymentMethod)) {
      response.status(400).json({ error: 'Choose the account used to return the payment.' })
      return
    }

    try {
      const result = await withWriteTransaction(getDatabase(), async (transaction) => {
        const orderResult = await transaction.query(
          `SELECT id, order_number, status, payment_status, currency
           FROM orders WHERE id = $1 FOR UPDATE`,
          [request.params.id],
        )
        const order = orderResult.rows[0]
        if (!order) return { error: 'Order not found', status: 404 }
        if (order.currency.trim() !== 'IQD') {
          return { error: 'Store accounting currently supports IQD orders only.', status: 409 }
        }
        if (!['paid', 'partially_paid', 'partially_refunded'].includes(order.payment_status)) {
          return { error: 'Only orders with recorded payments can be refunded.', status: 409 }
        }

        await transaction.query(
          `SELECT id FROM payments
           WHERE order_id = $1 AND refund_of_payment_id IS NULL
             AND status IN ('succeeded', 'partial_refunded')
           ORDER BY paid_at, created_at, id
           FOR UPDATE`,
          [order.id],
        )
        const originalPayments = await transaction.query(
          `SELECT original.id, original.amount_minor, original.status,
                  COALESCE(SUM(refund.amount_minor), 0)::bigint AS refunded_minor
           FROM payments original
           LEFT JOIN payments refund ON refund.refund_of_payment_id = original.id
           WHERE original.order_id = $1
             AND original.refund_of_payment_id IS NULL
             AND original.status IN ('succeeded', 'partial_refunded')
           GROUP BY original.id
           ORDER BY MIN(original.paid_at), MIN(original.created_at), original.id`,
          [order.id],
        )
        const remainingPaid = originalPayments.rows.reduce(
          (total, payment) => total + Number(payment.amount_minor) - Number(payment.refunded_minor),
          0,
        )
        if (amountMinor > remainingPaid) {
          return { error: 'Refund cannot exceed the amount still paid on this order.', status: 400 }
        }

        let amountRemaining = amountMinor
        const refunds = []
        for (const original of originalPayments.rows) {
          const refundable = Number(original.amount_minor) - Number(original.refunded_minor)
          if (refundable <= 0 || amountRemaining <= 0) continue
          const refundAmount = Math.min(refundable, amountRemaining)
          const refund = await transaction.query(
            `INSERT INTO payments
               (order_id, provider, idempotency_key, status, amount_minor, currency,
                payment_method, refund_of_payment_id, paid_at)
             VALUES ($1, 'manual_refund', $2, 'refunded', $3, $4, $5, $6, now())
             RETURNING id`,
            [
              order.id,
              `manual-order-refund:${order.id}:${randomBytes(12).toString('hex')}`,
              refundAmount,
              order.currency,
              paymentMethod,
              original.id,
            ],
          )
          await transaction.query(
            `INSERT INTO accounting_entries
               (entry_type, payment_method, direction, category, description,
                amount_minor, currency, order_id, payment_id, recorded_by)
             VALUES ('refund', $1, 'outflow', 'Order refund', $2, $3, $4, $5, $6, $7)`,
            [
              paymentMethod,
              `Refund for order ${order.order_number}`,
              refundAmount,
              order.currency,
              order.id,
              refund.rows[0].id,
              request.adminUser.id,
            ],
          )
          const newRefunded = Number(original.refunded_minor) + refundAmount
          await transaction.query(
            `UPDATE payments SET status = $1 WHERE id = $2`,
            [newRefunded >= Number(original.amount_minor) ? 'refunded' : 'partial_refunded', original.id],
          )
          refunds.push(refund.rows[0].id)
          amountRemaining -= refundAmount
        }
        const stillPaid = remainingPaid - amountMinor
        const updatedOrder = await transaction.query(
          `UPDATE orders SET payment_status = CASE
             WHEN $1 = 0 AND COALESCE(total_minor, 0) <= (
               SELECT COALESCE(SUM(amount_minor), 0) FROM payments
               WHERE order_id = $2 AND refund_of_payment_id IS NULL
             ) THEN 'refunded'
             WHEN $1 = 0 THEN 'partially_paid'
             WHEN payment_status = 'partially_refunded' OR $1 < COALESCE(
               (SELECT SUM(amount_minor) FROM payments
                WHERE order_id = $2 AND refund_of_payment_id IS NULL
                  AND status IN ('succeeded', 'partial_refunded', 'refunded')), 0
             ) THEN 'partially_refunded'
             ELSE 'partially_paid' END
           WHERE id = $2
           RETURNING payment_status`,
          [stillPaid, order.id],
        )
        return {
          refundIds: refunds,
          orderId: order.id,
          paymentStatus: updatedOrder.rows[0].payment_status,
          amountMinor,
          currency: order.currency.trim(),
        }
      })
      if (result.error) {
        response.status(result.status).json({ error: result.error })
        return
      }
      response.status(201).json({ refund: result })
    } catch (error) {
      console.error('Accounting order refund failed:', error)
      reportServerError(error, 'accounting.order_refund')
      response.status(500).json({ error: 'Unable to record refund' })
    }
  })

  app.get('/api/admin/accounting', requireAdmin, async (request, response) => {
    const from = request.query.from
    const to = request.query.to
    if (!validIsoDate(from) || !validIsoDate(to) || from > to) {
      response.status(400).json({ error: 'Choose a valid date range.' })
      return
    }
    if (new Date(`${to}T00:00:00.000Z`) - new Date(`${from}T00:00:00.000Z`) > 365 * 24 * 60 * 60 * 1000) {
      response.status(400).json({ error: 'Date range cannot exceed 366 calendar days.' })
      return
    }

    try {
      const database = getDatabase()
      const [period, balances, entries] = await Promise.all([
        database.query(
          `SELECT
             COALESCE(SUM(CASE
               WHEN entry.entry_type IN ('sale', 'manual_sale', 'other_income') THEN entry.amount_minor
               WHEN entry.entry_type = 'correction' AND original.entry_type IN ('sale', 'manual_sale', 'other_income')
                 THEN CASE WHEN entry.direction = 'inflow' THEN entry.amount_minor ELSE -entry.amount_minor END
               ELSE 0 END), 0)::bigint AS income_minor,
             COALESCE(SUM(CASE
               WHEN entry.entry_type = 'expense' THEN entry.amount_minor
               WHEN entry.entry_type = 'correction' AND original.entry_type = 'expense'
                 THEN CASE WHEN entry.direction = 'outflow' THEN entry.amount_minor ELSE -entry.amount_minor END
               ELSE 0 END), 0)::bigint AS expenses_minor,
             COALESCE(SUM(CASE
               WHEN entry.entry_type = 'refund' THEN entry.amount_minor
               WHEN entry.entry_type = 'correction' AND original.entry_type = 'refund'
                 THEN CASE WHEN entry.direction = 'inflow' THEN -entry.amount_minor ELSE entry.amount_minor END
               ELSE 0 END), 0)::bigint AS refunds_minor
           FROM accounting_entries entry
           LEFT JOIN accounting_entries original ON original.id = entry.reversal_of_entry_id
           WHERE entry.occurred_at >= $1::date AND entry.occurred_at < ($2::date + interval '1 day')
             AND entry.currency = 'IQD'
             AND (entry.entry_type <> 'correction' OR original.entry_type <> 'opening_balance')`,
          [from, to],
        ),
        database.query(
          `SELECT account,
             COALESCE(SUM(change_minor), 0)::bigint AS balance_minor
           FROM (
             SELECT entry.payment_method AS account,
               CASE WHEN entry.entry_type = 'transfer' OR (entry.entry_type = 'correction' AND original.entry_type = 'transfer')
                      THEN -entry.amount_minor
                    WHEN entry.direction = 'inflow' THEN entry.amount_minor
                    ELSE -entry.amount_minor END AS change_minor
             FROM accounting_entries entry
             LEFT JOIN accounting_entries original ON original.id = entry.reversal_of_entry_id
             WHERE entry.currency = 'IQD'
             UNION ALL
             SELECT CASE WHEN entry.entry_type = 'transfer' THEN entry.transfer_to ELSE original.payment_method END AS account,
                    entry.amount_minor AS change_minor
             FROM accounting_entries entry
             LEFT JOIN accounting_entries original ON original.id = entry.reversal_of_entry_id
             WHERE entry.currency = 'IQD'
               AND (entry.entry_type = 'transfer' OR (entry.entry_type = 'correction' AND original.entry_type = 'transfer'))
           ) movements
           GROUP BY account`,
        ),
        database.query(
          `SELECT entry.id, entry.entry_type, entry.payment_method, entry.transfer_to,
                  entry.direction, entry.category, entry.description, entry.amount_minor,
                  entry.currency, entry.order_id, entry.payment_id, entry.reversal_of_entry_id,
                  entry.occurred_at, original.entry_type AS reversed_entry_type
           FROM accounting_entries entry
           LEFT JOIN accounting_entries original ON original.id = entry.reversal_of_entry_id
           WHERE entry.occurred_at >= $1::date AND entry.occurred_at < ($2::date + interval '1 day')
           ORDER BY entry.occurred_at DESC, entry.created_at DESC LIMIT 5000`,
          [from, to],
        ),
      ])
      const totals = period.rows[0]
      const cashAndBank = { cash: 0, bank_transfer: 0 }
      for (const balance of balances.rows) cashAndBank[balance.account] = Number(balance.balance_minor)
      const incomeMinor = Number(totals.income_minor) - Number(totals.refunds_minor)
      const report = {
        currency: 'IQD',
        from,
        to,
        incomeMinor,
        expensesMinor: Number(totals.expenses_minor),
        refundsMinor: Number(totals.refunds_minor),
        netProfitMinor: incomeMinor - Number(totals.expenses_minor),
        balances: cashAndBank,
        entries: entries.rows.map((entry) => ({
          ...entry,
          amountMinor: Number(entry.amount_minor),
          currency: entry.currency.trim(),
        })),
      }
      if (request.query.format === 'csv') {
        const headers = ['date', 'type', 'category', 'description', 'account', 'transfer_to', 'direction', 'amount_minor', 'currency', 'order_id', 'reverses_entry_id']
        const rows = entries.rows.map((entry) => [
          new Date(entry.occurred_at).toISOString(),
          entry.entry_type,
          entry.category,
          entry.description,
          entry.payment_method,
          entry.transfer_to,
          entry.direction,
          entry.amount_minor,
          entry.currency.trim(),
          entry.order_id,
          entry.reversal_of_entry_id,
        ])
        response.type('text/csv')
        response.set('Content-Disposition', `attachment; filename="poshraw-accounting-${from}-to-${to}.csv"`)
        response.send([headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'))
        return
      }
      response.json(report)
    } catch (error) {
      console.error('Admin accounting report failed:', error)
      reportServerError(error, 'accounting.report')
      response.status(500).json({ error: 'Unable to load accounting report' })
    }
  })

  app.post('/api/admin/accounting/entries', checkOrigin, requireAdmin, async (request, response) => {
    const { entryType, paymentMethod, transferTo, category, description, amountMinor, occurredAt } = request.body || {}
    const normalizedCategory = typeof category === 'string' ? category.trim() : ''
    const normalizedDescription = typeof description === 'string' ? description.trim() : ''
    const supportedTypes = ['expense', 'other_income', 'manual_sale', 'opening_balance', 'transfer']
    if (!supportedTypes.includes(entryType)) {
      response.status(400).json({ error: 'Choose a valid income, expense, opening balance, or transfer entry.' })
      return
    }
    if (!['cash', 'bank_transfer'].includes(paymentMethod)) {
      response.status(400).json({ error: 'Choose cash or bank transfer.' })
      return
    }
    if (entryType === 'transfer'
      ? !['cash', 'bank_transfer'].includes(transferTo) || transferTo === paymentMethod
      : transferTo !== undefined && transferTo !== null && transferTo !== '') {
      response.status(400).json({ error: 'Choose two different accounts for a transfer.' })
      return
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) {
      response.status(400).json({ error: 'Enter a valid positive amount in IQD.' })
      return
    }
    if (normalizedCategory.length < 2 || normalizedCategory.length > 80
      || containsControlCharacters(normalizedCategory)) {
      response.status(400).json({ error: 'Enter a category between 2 and 80 characters.' })
      return
    }
    if (normalizedDescription.length < 2 || normalizedDescription.length > 500
      || containsControlCharacters(normalizedDescription)) {
      response.status(400).json({ error: 'Enter a description between 2 and 500 characters.' })
      return
    }
    if (!validIsoDate(occurredAt) || occurredAt > new Date().toISOString().slice(0, 10)) {
      response.status(400).json({ error: 'Enter a valid transaction date that is not in the future.' })
      return
    }

    try {
      const result = await withWriteTransaction(getDatabase(), async (transaction) => {
        if (entryType === 'opening_balance') {
          const existing = await transaction.query(
            `SELECT id FROM accounting_entries
             WHERE entry_type = 'opening_balance' AND payment_method = $1 LIMIT 1`,
            [paymentMethod],
          )
          if (existing.rows[0]) {
            return { error: `An opening balance already exists for ${paymentMethod}. Record a correction instead.`, status: 409 }
          }
        }
        const inserted = await transaction.query(
        `INSERT INTO accounting_entries
           (entry_type, payment_method, transfer_to, direction, category, description,
            amount_minor, currency, recorded_by, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'IQD', $8, $9::date)
         RETURNING id, entry_type, payment_method, transfer_to, direction, category, description,
                   amount_minor, currency, order_id, occurred_at`,
        [
          entryType,
          paymentMethod,
          entryType === 'transfer' ? transferTo : null,
          entryType === 'expense' ? 'outflow' : 'inflow',
          normalizedCategory,
          normalizedDescription,
          amountMinor,
          request.adminUser.id,
          occurredAt,
        ],
      )
        return { entry: inserted.rows[0] }
      })
      if (result.error) {
        response.status(result.status).json({ error: result.error })
        return
      }
      const entry = result.entry
      response.status(201).json({
        entry: { ...entry, amountMinor: Number(entry.amount_minor), currency: entry.currency.trim() },
      })
    } catch (error) {
      console.error('Admin accounting entry failed:', error)
      reportServerError(error, 'accounting.entry')
      if (error.code === '23505') {
        response.status(409).json({ error: 'This account already has an opening balance. Record a correction instead.' })
        return
      }
      response.status(500).json({ error: 'Unable to record accounting entry' })
    }
  })

  app.post('/api/admin/accounting/entries/:id/correct', checkOrigin, requireAdmin, async (request, response) => {
    const explanation = typeof request.body?.description === 'string'
      ? request.body.description.trim()
      : ''
    if (explanation.length < 3 || explanation.length > 500 || containsControlCharacters(explanation)) {
      response.status(400).json({ error: 'Enter a correction explanation between 3 and 500 characters.' })
      return
    }

    try {
      const result = await withWriteTransaction(getDatabase(), async (transaction) => {
        const originalResult = await transaction.query(
          `SELECT id, entry_type, payment_method, transfer_to, direction,
                  amount_minor, currency, order_id, payment_id
           FROM accounting_entries WHERE id = $1 FOR UPDATE`,
          [request.params.id],
        )
        const original = originalResult.rows[0]
        if (!original) return { error: 'Accounting entry not found.', status: 404 }
        if (original.entry_type === 'correction' || original.order_id || original.payment_id) {
          return {
            error: 'Order payments, refunds, and existing corrections must be corrected through their source transaction.',
            status: 409,
          }
        }
        const existingCorrection = await transaction.query(
          'SELECT id FROM accounting_entries WHERE reversal_of_entry_id = $1',
          [original.id],
        )
        if (existingCorrection.rows[0]) return { error: 'This entry already has a correction.', status: 409 }

        const isTransfer = original.entry_type === 'transfer'
        const correction = await transaction.query(
          `INSERT INTO accounting_entries
             (entry_type, payment_method, transfer_to, direction, category, description,
              amount_minor, currency, reversal_of_entry_id, recorded_by, occurred_at)
           VALUES ('correction', $1, $2, $3, 'Correction', $4, $5, $6, $7, $8, now())
           RETURNING id, entry_type, payment_method, transfer_to, direction,
                     category, description, amount_minor, currency, occurred_at`,
          [
            isTransfer ? original.transfer_to : original.payment_method,
            isTransfer ? original.payment_method : null,
            isTransfer ? original.direction : original.direction === 'inflow' ? 'outflow' : 'inflow',
            explanation,
            original.amount_minor,
            original.currency,
            original.id,
            request.adminUser.id,
          ],
        )
        return { entry: correction.rows[0] }
      })
      if (result.error) {
        response.status(result.status).json({ error: result.error })
        return
      }
      response.status(201).json({
        entry: {
          ...result.entry,
          amountMinor: Number(result.entry.amount_minor),
          currency: result.entry.currency.trim(),
        },
      })
    } catch (error) {
      console.error('Accounting entry correction failed:', error)
      reportServerError(error, 'accounting.correction')
      response.status(500).json({ error: 'Unable to correct accounting entry' })
    }
  })

  app.get('/api/admin/analytics', requireAdmin, async (_request, response) => {
    try {
      const database = getDatabase()
      const [views, orders, dailyViews, dailyOrders, topPages] = await Promise.all([
        database.query(
          `SELECT count(*)::int AS count
           FROM site_page_views WHERE created_at >= now() - interval '30 days'`,
        ),
        database.query(
          `SELECT count(*)::int AS count
           FROM orders WHERE placed_at >= now() - interval '30 days'`,
        ),
        database.query(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  count(*)::int AS count
           FROM site_page_views
           WHERE created_at >= now() - interval '30 days'
           GROUP BY date_trunc('day', created_at)`,
        ),
        database.query(
          `SELECT to_char(date_trunc('day', placed_at), 'YYYY-MM-DD') AS day,
                  count(*)::int AS count
           FROM orders
           WHERE placed_at >= now() - interval '30 days'
           GROUP BY date_trunc('day', placed_at)`,
        ),
        database.query(
          `SELECT path, count(*)::int AS count
           FROM site_page_views
           WHERE created_at >= now() - interval '30 days'
           GROUP BY path ORDER BY count(*) DESC, path LIMIT 10`,
        ),
      ])
      response.json({
        periodDays: 30,
        pageViews: views.rows[0].count,
        orderRequests: orders.rows[0].count,
        orderRequestsPerPageView: views.rows[0].count
          ? Number((orders.rows[0].count * 100 / views.rows[0].count).toFixed(2))
          : 0,
        dailyPageViews: dailyViews.rows,
        dailyOrderRequests: dailyOrders.rows,
        topPages: topPages.rows,
      })
    } catch (error) {
      console.error('Admin analytics request failed:', error)
      reportServerError(error, 'admin.analytics')
      response.status(500).json({ error: 'Unable to load analytics' })
    }
  })
}