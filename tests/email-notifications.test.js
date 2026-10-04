import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import {
  createEmailNotificationWorker,
  queueOrderEmail,
  renderOrderNotification,
} from '../server/email-notifications.js'

async function createQueuedNotification(database, recipientEmail = 'customer@example.test') {
  const customer = await database.query(
    `INSERT INTO customers (full_name, phone, email, preferred_locale)
     VALUES ('Test Customer', '+9647701234567', $1, 'en') RETURNING id`,
    [recipientEmail],
  )
  const order = await database.query(
    `INSERT INTO orders (customer_id, customer_name_snapshot, customer_phone_snapshot)
     VALUES ($1, 'Test Customer', '+9647701234567') RETURNING id, order_number`,
    [customer.rows[0].id],
  )
  const event = await database.query(
    `INSERT INTO order_status_events (order_id, new_status, actor_type)
     VALUES ($1, 'pending', 'customer') RETURNING id`,
    [order.rows[0].id],
  )
  await queueOrderEmail(database, {
    orderId: order.rows[0].id,
    statusEventId: event.rows[0].id,
    recipientEmail,
    locale: 'en',
    notificationType: 'order_received',
    payload: { orderNumber: order.rows[0].order_number, status: 'pending', items: [] },
  })
  return order.rows[0]
}

test('queued order email is delivered and marked sent', async () => {
  const database = new PGlite()
  await database.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  const order = await createQueuedNotification(database)
  const messages = []
  const worker = createEmailNotificationWorker({
    getDatabase: () => database,
    transport: {
      from: 'store@example.test',
      client: {
        sendMail: async (message) => messages.push(message),
        close: async () => {},
      },
    },
    pollIntervalMs: 5,
  })

  try {
    worker.start()
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await database.query(
        'SELECT status FROM email_notification_outbox WHERE order_id = $1',
        [order.id],
      )
      if (result.rows[0].status === 'sent') break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const result = await database.query(
      'SELECT status, attempts FROM email_notification_outbox WHERE order_id = $1',
      [order.id],
    )
    assert.equal(result.rows[0].status, 'sent')
    assert.equal(result.rows[0].attempts, 1)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].to, 'customer@example.test')
    assert.match(messages[0].subject, /Order received/)
  } finally {
    await worker.stop()
    await database.close()
  }
})

test('failed delivery is recorded and scheduled for retry without exposing provider details', async () => {
  const database = new PGlite()
  await database.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  const order = await createQueuedNotification(database)
  const logged = []
  const worker = createEmailNotificationWorker({
    getDatabase: () => database,
    transport: {
      from: 'store@example.test',
      client: {
        sendMail: async () => {
          const error = new Error('Provider error contains sensitive details')
          error.code = 'ECONNECTION'
          throw error
        },
        close: async () => {},
      },
    },
    logger: { error: (...args) => logged.push(args) },
    pollIntervalMs: 5,
  })

  try {
    worker.start()
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await database.query(
        'SELECT attempts FROM email_notification_outbox WHERE order_id = $1',
        [order.id],
      )
      if (result.rows[0].attempts > 0) break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const result = await database.query(
      'SELECT status, attempts, last_error, next_attempt_at FROM email_notification_outbox WHERE order_id = $1',
      [order.id],
    )
    assert.equal(result.rows[0].status, 'pending')
    assert.equal(result.rows[0].attempts, 1)
    assert.equal(result.rows[0].last_error, 'ECONNECTION')
    assert.ok(new Date(result.rows[0].next_attempt_at) > new Date())
    assert.equal(logged.length, 1)
    assert.doesNotMatch(JSON.stringify(logged), /sensitive details/)
  } finally {
    await worker.stop()
    await database.close()
  }
})

test('order email HTML escapes customer-controlled content', () => {
  const content = renderOrderNotification({
    locale: 'en',
    notification_type: 'order_received',
    payload: {
      orderNumber: 'PR-123',
      status: 'pending',
      items: [{ name: '<img src=x>', color: '& blue', size: '"small"', quantity: 1 }],
    },
  })
  assert.match(content.html, /&lt;img src=x&gt;/)
  assert.match(content.html, /&amp; blue/)
  assert.doesNotMatch(content.html, /<img src=x>/)
})
