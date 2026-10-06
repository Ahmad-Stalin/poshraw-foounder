import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import {
  createWhatsAppNotificationWorker,
  createWhatsAppTransport,
  normalizeWhatsAppPhone,
  queueWhatsAppNotification,
} from '../server/whatsapp-notifications.js'

const configuredEnvironment = {
  WHATSAPP_ACCESS_TOKEN: 'test-access-token',
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_GRAPH_API_VERSION: 'v25.0',
  WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'poshraw_order_received',
  WHATSAPP_TEMPLATE_ORDER_STATUS: 'poshraw_order_status',
  WHATSAPP_TEMPLATE_REFUND: 'poshraw_refund',
  WHATSAPP_TEMPLATE_LOCALE_EN: 'en_US',
  WHATSAPP_TEMPLATE_LOCALE_CKB: 'ckb',
}

test('WhatsApp phone normalization accepts Iraqi local and international numbers', () => {
  assert.equal(normalizeWhatsAppPhone('0770 123 4567'), '9647701234567')
  assert.equal(normalizeWhatsAppPhone('+9647701234567'), '9647701234567')
  assert.equal(normalizeWhatsAppPhone('9647701234567'), '9647701234567')
  assert.equal(normalizeWhatsAppPhone('07701234567'), '9647701234567')
  assert.equal(normalizeWhatsAppPhone('0770'), null)
  assert.equal(normalizeWhatsAppPhone('1234567890'), null)
})

test('WhatsApp configuration stays disabled when absent and rejects partial configuration', () => {
  assert.equal(createWhatsAppTransport({}), null)
  assert.throws(
    () => createWhatsAppTransport({ WHATSAPP_ACCESS_TOKEN: 'configured' }),
    /configuration is incomplete/,
  )
})

test('WhatsApp Cloud API worker sends the approved order template and marks it delivered', async () => {
  const database = new PGlite()
  await database.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  const customer = await database.query(
    `INSERT INTO customers (full_name, phone, preferred_locale)
     VALUES ('Test Customer', '+9647701234567', 'en') RETURNING id`,
  )
  const order = await database.query(
    `INSERT INTO orders (customer_id, customer_phone_snapshot, whatsapp_updates_consent_at)
     VALUES ($1, '+9647701234567', now()) RETURNING id, order_number`,
    [customer.rows[0].id],
  )
  const event = await database.query(
    `INSERT INTO order_status_events (order_id, new_status, actor_type)
     VALUES ($1, 'pending', 'customer') RETURNING id`,
    [order.rows[0].id],
  )
  await queueWhatsAppNotification(database, {
    orderId: order.rows[0].id,
    statusEventId: event.rows[0].id,
    recipientPhone: '+9647701234567',
    locale: 'en',
    notificationType: 'order_received',
    payload: { orderNumber: order.rows[0].order_number },
  })

  const requests = []
  const transport = createWhatsAppTransport(configuredEnvironment, async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) })
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.test' }] }) }
  })
  const worker = createWhatsAppNotificationWorker({
    getDatabase: () => database,
    transport,
    pollIntervalMs: 5,
  })

  try {
    worker.start()
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await database.query(
        'SELECT status FROM whatsapp_notification_outbox WHERE order_id = $1',
        [order.rows[0].id],
      )
      if (result.rows[0].status === 'sent') break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const result = await database.query(
      'SELECT status, attempts FROM whatsapp_notification_outbox WHERE order_id = $1',
      [order.rows[0].id],
    )
    assert.equal(result.rows[0].status, 'sent')
    assert.equal(result.rows[0].attempts, 1)
    assert.equal(requests.length, 1)
    assert.equal(
      requests[0].url,
      'https://graph.facebook.com/v25.0/123456789012345/messages',
    )
    assert.equal(requests[0].options.headers.Authorization, 'Bearer test-access-token')
    assert.equal(requests[0].body.to, '9647701234567')
    assert.equal(requests[0].body.template.name, 'poshraw_order_received')
    assert.deepEqual(requests[0].body.template.components[0].parameters, [
      { type: 'text', text: order.rows[0].order_number },
    ])
  } finally {
    await worker.stop()
    await database.close()
  }
})
