import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { registerAnalyticsRoutes } from '../server/analytics.js'
import { registerAdminRoutes } from '../server/admin.js'
import { registerOrderRoutes } from '../server/orders.js'

test('customer order records consent, delivery quote and item snapshots, then releases reserved stock on cancel', async () => {
  const database = new PGlite()
  await database.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  await database.exec(await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8'))
  const selected = await database.query(
    `SELECT v.id FROM product_variants v
     JOIN products p ON p.id = v.product_id
     WHERE p.sku = $1 ORDER BY v.variant_sku LIMIT 1`,
    ['POSH-KG-001'],
  )
  const variantId = selected.rows[0].id
  await database.query('UPDATE products SET price_minor = $1 WHERE sku = $2', [2500000, 'POSH-KG-001'])
  await database.query('UPDATE product_variants SET track_inventory = true, stock_on_hand = 5 WHERE id = $1', [variantId])

  const app = express()
  app.use(express.json())
  const getDatabase = () => database
  const setupToken = 'test-only-checkout-admin-token-5582'
  registerAdminRoutes(app, {
    getDatabase,
    isProduction: false,
    setupToken,
    configuredOrigins: ['http://localhost:5173'],
  })
  registerOrderRoutes(app, { getDatabase, configuredOrigins: ['http://localhost:5173'] })
  registerAnalyticsRoutes(app, { getDatabase, configuredOrigins: ['http://localhost:5173'] })

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const request = (path, { method = 'GET', body, cookie, origin = 'http://localhost:5173' } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  try {
    const baseOrder = {
      locale: 'en',
      customerName: 'Test Customer',
      phone: '+9647701234567',
      email: 'customer@example.test',
      fulfillmentMethod: 'delivery',
      deliveryAddress: 'Test address, Sulaymaniyah',
      privacyAccepted: true,
      whatsappUpdatesAccepted: true,
      items: [{ variantId, quantity: 3 }],
    }

    assert.equal((await request('/api/orders', { method: 'POST', origin: 'https://attacker.example', body: baseOrder })).status, 403)
    assert.equal((await request('/api/orders', { method: 'POST', body: { ...baseOrder, privacyAccepted: false } })).status, 400)

    const orderResponse = await request('/api/orders', { method: 'POST', body: baseOrder })
    assert.equal(orderResponse.status, 201)
    const { order } = await orderResponse.json()
    assert.equal(order.fulfillmentMethod, 'delivery')
    assert.equal(order.subtotalMinor, 7500000)
    assert.equal(order.deliveryMinor, null)
    assert.equal(order.totalMinor, null)
    assert.equal(order.totalConfirmed, false)

    const orderRow = await database.query('SELECT * FROM orders WHERE id = $1', [order.id])
    assert.equal(orderRow.rows[0].privacy_notice_version, '2026-10-05-v3')
    assert.ok(orderRow.rows[0].privacy_consent_at)
    assert.ok(orderRow.rows[0].whatsapp_updates_consent_at)
    assert.equal(orderRow.rows[0].customer_phone_snapshot, baseOrder.phone)
    assert.equal(orderRow.rows[0].delivery_address_snapshot.address, baseOrder.deliveryAddress)
    const receivedEmail = await database.query(
      `SELECT notification_type, recipient_email, payload
       FROM email_notification_outbox WHERE order_id = $1`,
      [order.id],
    )
    assert.equal(receivedEmail.rows.length, 1)
    assert.equal(receivedEmail.rows[0].notification_type, 'order_received')
    assert.equal(receivedEmail.rows[0].recipient_email, baseOrder.email)
    assert.equal(receivedEmail.rows[0].payload.orderNumber, order.orderNumber)
    const receivedWhatsApp = await database.query(
      `SELECT notification_type, recipient_phone, payload
       FROM whatsapp_notification_outbox WHERE order_id = $1`,
      [order.id],
    )
    assert.equal(receivedWhatsApp.rows.length, 1)
    assert.equal(receivedWhatsApp.rows[0].notification_type, 'order_received')
    assert.equal(receivedWhatsApp.rows[0].recipient_phone, '9647701234567')
    assert.equal(receivedWhatsApp.rows[0].payload.orderNumber, order.orderNumber)

    const itemRow = await database.query('SELECT quantity, unit_price_minor, line_total_minor FROM order_items WHERE order_id = $1', [order.id])
    assert.equal(itemRow.rows[0].quantity, 3)
    assert.equal(itemRow.rows[0].unit_price_minor, 2500000)
    assert.equal(itemRow.rows[0].line_total_minor, 7500000)

    const reservedStock = await database.query('SELECT stock_on_hand FROM product_variants WHERE id = $1', [variantId])
    assert.equal(reservedStock.rows[0].stock_on_hand, 2)

    const pickupResponse = await request('/api/orders', {
      method: 'POST',
      body: {
        ...baseOrder,
        email: '',
        whatsappUpdatesAccepted: false,
        fulfillmentMethod: 'pickup',
        deliveryAddress: '',
        items: [{ variantId, quantity: 1 }],
      },
    })
    assert.equal(pickupResponse.status, 201)
    const pickupOrder = (await pickupResponse.json()).order
    assert.equal(pickupOrder.fulfillmentMethod, 'pickup')
    assert.equal(pickupOrder.subtotalMinor, 2500000)
    assert.equal(pickupOrder.deliveryMinor, 0)
    assert.equal(pickupOrder.totalMinor, 2500000)
    assert.equal(pickupOrder.totalConfirmed, true)
    const optionalEmail = await database.query(
      'SELECT count(*)::int AS count FROM email_notification_outbox WHERE order_id = $1',
      [pickupOrder.id],
    )
    assert.equal(optionalEmail.rows[0].count, 0)
    const noWhatsAppOptIn = await database.query(
      'SELECT count(*)::int AS count FROM whatsapp_notification_outbox WHERE order_id = $1',
      [pickupOrder.id],
    )
    assert.equal(noWhatsAppOptIn.rows[0].count, 0)

    const outOfStock = await request('/api/orders', {
      method: 'POST',
      body: { ...baseOrder, items: [{ variantId, quantity: 3 }] },
    })
    assert.equal(outOfStock.status, 409)

    const setup = await request('/api/admin/setup', {
      method: 'POST',
      body: { setupToken, email: 'orders-admin@example.test', password: 'test-only-orders-password-19!' },
    })
    assert.equal(setup.status, 201)
    const adminCookie = setup.headers.get('set-cookie')?.split(';')[0]
    const cancel = await request(`/api/admin/orders/${order.id}/status`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'cancelled' },
    })
    assert.equal(cancel.status, 200)
    const releasedStock = await database.query('SELECT stock_on_hand FROM product_variants WHERE id = $1', [variantId])
    assert.equal(releasedStock.rows[0].stock_on_hand, 4)
    const movements = await database.query(
      'SELECT movement_type, quantity_delta FROM inventory_movements WHERE order_id = $1 ORDER BY created_at',
      [order.id],
    )
    assert.deepEqual(movements.rows.map((movement) => [movement.movement_type, movement.quantity_delta]), [
      ['reservation', -3],
      ['release', 3],
    ])
    const statusEmail = await database.query(
      `SELECT notification_type, payload
       FROM email_notification_outbox WHERE order_id = $1
       ORDER BY created_at`,
      [order.id],
    )
    assert.deepEqual(statusEmail.rows.map((row) => row.notification_type), ['order_received', 'order_status'])
    assert.equal(statusEmail.rows[1].payload.status, 'cancelled')
    const statusWhatsApp = await database.query(
      `SELECT notification_type, payload
       FROM whatsapp_notification_outbox WHERE order_id = $1
       ORDER BY created_at`,
      [order.id],
    )
    assert.deepEqual(statusWhatsApp.rows.map((row) => row.notification_type), ['order_received', 'order_status'])
    assert.equal(statusWhatsApp.rows[1].payload.status, 'cancelled')

    const pageView = await request('/api/analytics/page-view', {
      method: 'POST',
      body: { path: '/?utm_source=private#products' },
    })
    assert.equal(pageView.status, 202)
    const unsafePageView = await request('/api/analytics/page-view', {
      method: 'POST',
      body: { path: 'https://attacker.example/path' },
    })
    assert.equal(unsafePageView.status, 400)
    const analyticsResponse = await request('/api/admin/analytics', { cookie: adminCookie })
    assert.equal(analyticsResponse.status, 200)
    const analytics = await analyticsResponse.json()
    assert.equal(analytics.pageViews, 1)
    assert.equal(analytics.orderRequests, 2)
    assert.equal(analytics.orderRequestsPerPageView, 200)
    assert.equal(analytics.topPages[0].path, '/')
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await database.close()
  }
})