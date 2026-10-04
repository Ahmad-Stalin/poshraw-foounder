import { withWriteTransaction } from './transactions.js'
import { createRateLimiter } from './rate-limits.js'
import { queueOrderEmail } from './email-notifications.js'
import { reportServerError } from './monitoring.js'

const orderWindowMs = 15 * 60 * 1000
const orderLimit = 8

function requestOriginAllowed(request, allowedOrigins) {
  const origin = request.get('origin')
  if (!origin) return false
  const protocol = request.get('x-forwarded-proto')?.split(',')[0] || request.protocol
  return origin === `${protocol}://${request.get('host')}` || allowedOrigins.has(origin)
}

function orderOriginGuard(allowedOrigins) {
  return (request, response, next) => {
    if (!requestOriginAllowed(request, allowedOrigins)) {
      response.status(403).json({ error: 'Request origin is not allowed' })
      return
    }
    next()
  }
}

function validationError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

function validateOrder(body) {
  const customerName = typeof body?.customerName === 'string' ? body.customerName.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const locale = body?.locale === 'en' ? 'en' : body?.locale === 'ckb' ? 'ckb' : null
  const fulfillmentMethod = body?.fulfillmentMethod
  const deliveryAddress = typeof body?.deliveryAddress === 'string' ? body.deliveryAddress.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  const privacyAccepted = body?.privacyAccepted === true
  const items = body?.items

  if (customerName.length < 2 || customerName.length > 120) {
    throw validationError('Enter a name between 2 and 120 characters.')
  }
  if (!/^\+?[0-9\s().-]{7,24}$/.test(phone)) {
    throw validationError('Enter a valid phone number.')
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw validationError('Enter a valid email address or leave it blank.')
  }
  if (!locale) throw validationError('Unsupported language.')
  if (!privacyAccepted) throw validationError('Consent is required to save order details.')
  if (!['pickup', 'delivery'].includes(fulfillmentMethod)) {
    throw validationError('Choose pickup or delivery.')
  }
  if (fulfillmentMethod === 'delivery' && (deliveryAddress.length < 8 || deliveryAddress.length > 500)) {
    throw validationError('Enter a delivery address between 8 and 500 characters.')
  }
  if (note.length > 1000) throw validationError('Order note must be under 1000 characters.')
  if (!Array.isArray(items) || items.length < 1 || items.length > 10) {
    throw validationError('Choose between 1 and 10 items.')
  }

  const seenVariants = new Set()
  const normalizedItems = items.map((item) => {
    if (typeof item?.variantId !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.variantId)) {
      throw validationError('An item selection is invalid.')
    }
    const quantity = item.quantity
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
      throw validationError('Each item quantity must be between 1 and 10.')
    }
    if (seenVariants.has(item.variantId)) throw validationError('Duplicate item selection.')
    seenVariants.add(item.variantId)
    return { variantId: item.variantId, quantity }
  })

  return { customerName, phone, email: email || null, locale, fulfillmentMethod, deliveryAddress, note, items: normalizedItems }
}

export function registerOrderRoutes(app, { getDatabase, configuredOrigins = [], isProduction = false }) {
  const allowedOrigins = new Set(configuredOrigins)
  if (!isProduction) {
    allowedOrigins.add('http://localhost:5173')
    allowedOrigins.add('http://127.0.0.1:5173')
  }
  const checkOrderOrigin = orderOriginGuard(allowedOrigins)
  const rateLimitOrders = createRateLimiter(getDatabase, {
    scope: 'public-orders',
    limit: orderLimit,
    windowMs: orderWindowMs,
    message: 'Too many order attempts. Please contact the store.',
  })

  app.post('/api/orders', checkOrderOrigin, rateLimitOrders, async (request, response) => {
    let orderInput
    try {
      orderInput = validateOrder(request.body)
    } catch (error) {
      response.status(error.status || 400).json({ error: error.message })
      return
    }

    const database = getDatabase()
    try {
      const order = await withWriteTransaction(database, async (transaction) => {
        const selectedItems = []
        const currencies = new Set()
        let allPricesKnown = true
        let subtotalMinor = 0

        for (const item of orderInput.items) {
          const result = await transaction.query(
            `SELECT v.id, v.variant_sku, v.product_id, v.color_code, v.size_code,
                    v.price_minor AS variant_price_minor, v.currency AS variant_currency,
                    v.track_inventory, v.stock_on_hand, v.is_active AS variant_active,
                    p.sku, p.status AS product_status, p.archived_at,
                    p.price_minor AS product_price_minor, p.currency AS product_currency,
                    t.name AS product_name, c.name_en AS color_en, c.name_ckb AS color_ckb,
                    s.label AS size_label
             FROM product_variants v
             JOIN products p ON p.id = v.product_id
             JOIN product_translations t ON t.product_id = p.id AND t.locale = $2
             JOIN color_options c ON c.code = v.color_code
             JOIN sizes s ON s.code = v.size_code
             WHERE v.id = $1 AND c.is_active AND s.is_active
             FOR UPDATE OF v`,
            [item.variantId, orderInput.locale],
          )
          const variant = result.rows[0]
          if (!variant || !variant.variant_active || variant.product_status !== 'active' || variant.archived_at) {
            throw validationError('One selected product is no longer available.', 409)
          }
          if (variant.track_inventory && variant.stock_on_hand < item.quantity) {
            throw validationError(`Not enough stock for ${variant.product_name} (${variant.size_label}).`, 409)
          }

          const currency = variant.variant_currency.trim()
          const priceMinor = variant.variant_price_minor === null
            ? variant.product_price_minor === null ? null : Number(variant.product_price_minor)
            : Number(variant.variant_price_minor)
          currencies.add(currency)
          if (priceMinor === null) allPricesKnown = false
          else subtotalMinor += priceMinor * item.quantity
          selectedItems.push({
            ...item,
            productId: variant.product_id,
            productSku: variant.sku,
            variantSku: variant.variant_sku,
            productName: variant.product_name,
            colorName: orderInput.locale === 'ckb' ? variant.color_ckb : variant.color_en,
            sizeLabel: variant.size_label,
            currency,
            priceMinor,
            trackInventory: variant.track_inventory,
          })
        }

        if (currencies.size !== 1) throw validationError('Selected items use different currencies.')

        const currency = [...currencies][0]
        const subtotal = allPricesKnown ? subtotalMinor : null
        const deliveryMinor = orderInput.fulfillmentMethod === 'pickup' ? 0 : null
        const total = subtotal === null || deliveryMinor === null ? null : subtotal + deliveryMinor
        const customerResult = await transaction.query(
          `INSERT INTO customers (full_name, phone, email, preferred_locale)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [orderInput.customerName, orderInput.phone, orderInput.email, orderInput.locale],
        )
        const customerId = customerResult.rows[0].id
        const addressSnapshot = JSON.stringify({
          method: orderInput.fulfillmentMethod,
          address: orderInput.fulfillmentMethod === 'delivery' ? orderInput.deliveryAddress : null,
        })
        const orderResult = await transaction.query(
          `INSERT INTO orders (
             customer_id, source, status, payment_status, currency,
             subtotal_minor, delivery_minor, total_minor,
             customer_name_snapshot, customer_phone_snapshot,
             delivery_address_snapshot, customer_note,
             privacy_consent_at, privacy_notice_version
           )
           VALUES ($1, 'website', 'pending', 'unpaid', $2, $3, $4, $5, $6, $7, $8::jsonb, $9, now(), $10)
           RETURNING id, order_number, placed_at`,
          [
            customerId,
            currency,
            subtotal,
            deliveryMinor,
            total,
            orderInput.customerName,
            orderInput.phone,
            addressSnapshot,
            orderInput.note || null,
            '2026-10-04-v2',
          ],
        )
        const createdOrder = orderResult.rows[0]

        for (const item of selectedItems) {
          await transaction.query(
            `INSERT INTO order_items (
               order_id, variant_id, product_sku_snapshot, product_name_snapshot,
               color_name_snapshot, size_label_snapshot, quantity, unit_price_minor, currency
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              createdOrder.id,
              item.variantId,
              item.productSku,
              item.productName,
              item.colorName,
              item.sizeLabel,
              item.quantity,
              item.priceMinor,
              item.currency,
            ],
          )

          if (item.trackInventory) {
            await transaction.query(
              `UPDATE product_variants
               SET stock_on_hand = stock_on_hand - $1
               WHERE id = $2 AND stock_on_hand >= $1`,
              [item.quantity, item.variantId],
            )
            await transaction.query(
              `INSERT INTO inventory_movements (variant_id, order_id, movement_type, quantity_delta, note)
               VALUES ($1, $2, 'reservation', $3, $4)`,
              [item.variantId, createdOrder.id, -item.quantity, `Reserved for ${createdOrder.order_number}`],
            )
          }
        }

        const statusEvent = await transaction.query(
          `INSERT INTO order_status_events (order_id, previous_status, new_status, actor_type, note)
           VALUES ($1, NULL, 'pending', 'customer', 'Order submitted from storefront')
           RETURNING id`,
          [createdOrder.id],
        )
        if (orderInput.email) {
          await queueOrderEmail(transaction, {
            orderId: createdOrder.id,
            statusEventId: statusEvent.rows[0].id,
            recipientEmail: orderInput.email,
            locale: orderInput.locale,
            notificationType: 'order_received',
            payload: {
              orderNumber: createdOrder.order_number,
              status: 'pending',
              items: selectedItems.map((item) => ({
                name: item.productName,
                color: item.colorName,
                size: item.sizeLabel,
                quantity: item.quantity,
              })),
            },
          })
        }

        return {
          id: createdOrder.id,
          orderNumber: createdOrder.order_number,
          status: 'pending',
          fulfillmentMethod: orderInput.fulfillmentMethod,
          currency,
          subtotalMinor: subtotal,
          deliveryMinor,
          totalMinor: total,
          totalConfirmed: total !== null,
          createdAt: createdOrder.placed_at,
        }
      })

      response.status(201).json({ order })
    } catch (error) {
      if (error.status) {
        response.status(error.status).json({ error: error.message })
        return
      }
      console.error('Public order creation failed:', error)
      reportServerError(error, 'orders.create')
      response.status(500).json({ error: 'Unable to submit order. Please contact the store.' })
    }
  })
}