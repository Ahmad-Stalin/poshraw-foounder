import { withWriteTransaction } from './transactions.js'
import { reportServerError } from './monitoring.js'

const maxAttempts = 8
const retryBaseMs = 60 * 1000
const retryMaxMs = 6 * 60 * 60 * 1000

const statusLabels = {
  en: {
    pending: 'Order received',
    confirmed: 'Confirmed',
    processing: 'Being prepared',
    ready: 'Ready',
    shipped: 'Shipped',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
  ckb: {
    pending: 'داواکاری وەرگیرا',
    confirmed: 'پشتڕاست کرایەوە',
    processing: 'ئامادە دەکرێت',
    ready: 'ئامادەیە',
    shipped: 'نێردراوە',
    completed: 'تەواو بوو',
    cancelled: 'هەڵوەشایەوە',
  },
}

const paymentStatusLabels = {
  en: {
    partially_paid: 'Partially paid',
    partially_refunded: 'Partially refunded',
    refunded: 'Refunded',
  },
  ckb: {
    partially_paid: 'بەشێک پارەدراوە',
    partially_refunded: 'بەشێک پارە گەڕێندراوەتەوە',
    refunded: 'پارەکە گەڕێندراوەتەوە',
  },
}

export function formatMinorAmount(amountMinor, currency, locale) {
  const currencyLocale = locale === 'ckb' ? 'ckb-IQ' : 'en-IQ'
  const formatter = new Intl.NumberFormat(currencyLocale, { style: 'currency', currency })
  const scale = 10 ** formatter.resolvedOptions().maximumFractionDigits
  return formatter.format(amountMinor / scale)
}

function templateParameters(notification) {
  const isSorani = notification.locale === 'ckb'
  const payload = notification.payload
  if (notification.notification_type === 'order_received') {
    return [String(payload.orderNumber)]
  }
  if (notification.notification_type === 'refund') {
    return [
      String(payload.orderNumber),
      String(payload.amount),
      paymentStatusLabels[isSorani ? 'ckb' : 'en'][payload.paymentStatus] || String(payload.paymentStatus),
    ]
  }
  let status = statusLabels[isSorani ? 'ckb' : 'en'][payload.status] || payload.status
  if (payload.status === 'ready') {
    status = payload.fulfillmentMethod === 'pickup'
      ? isSorani ? 'ئامادەی وەرگرتنە' : 'Ready for pickup'
      : isSorani ? 'ئامادەی گەیاندنە' : 'Ready for delivery'
  }
  return [String(payload.orderNumber), String(status)]
}

export function normalizeWhatsAppPhone(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '').replace(/^00/, '')
  let international = digits
  if (/^07\d{9}$/.test(digits)) international = `964${digits.slice(1)}`
  else if (/^7\d{9}$/.test(digits)) international = `964${digits}`
  else if (/^9647\d{9}$/.test(digits)) international = digits
  else if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null
  return /^[1-9]\d{7,14}$/.test(international) ? international : null
}

export function createWhatsAppTransport(environment = process.env, fetchImpl = globalThis.fetch) {
  const required = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_GRAPH_API_VERSION',
    'WHATSAPP_TEMPLATE_ORDER_RECEIVED',
    'WHATSAPP_TEMPLATE_ORDER_STATUS',
    'WHATSAPP_TEMPLATE_REFUND',
    'WHATSAPP_TEMPLATE_LOCALE_EN',
    'WHATSAPP_TEMPLATE_LOCALE_CKB',
  ]
  const configured = required.some((key) => Boolean(environment[key]))
  if (!configured) return null
  const missing = required.filter((key) => !environment[key])
  if (missing.length) throw new Error(`WhatsApp configuration is incomplete: ${missing.join(', ')}.`)
  if (!/^v\d+\.\d+$/.test(environment.WHATSAPP_GRAPH_API_VERSION)) {
    throw new Error('WHATSAPP_GRAPH_API_VERSION must look like v25.0.')
  }
  if (!/^\d{5,30}$/.test(environment.WHATSAPP_PHONE_NUMBER_ID)) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID must be a Meta WhatsApp phone-number ID.')
  }
  for (const key of [
    'WHATSAPP_TEMPLATE_ORDER_RECEIVED',
    'WHATSAPP_TEMPLATE_ORDER_STATUS',
    'WHATSAPP_TEMPLATE_REFUND',
  ]) {
    if (!/^[a-z0-9_]{1,512}$/.test(environment[key])) {
      throw new Error(`${key} must be a valid approved WhatsApp template name.`)
    }
  }
  for (const key of ['WHATSAPP_TEMPLATE_LOCALE_EN', 'WHATSAPP_TEMPLATE_LOCALE_CKB']) {
    if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(environment[key])) {
      throw new Error(`${key} must be a valid WhatsApp template language code.`)
    }
  }
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is required for WhatsApp notifications.')

  const templateNames = {
    order_received: environment.WHATSAPP_TEMPLATE_ORDER_RECEIVED,
    order_status: environment.WHATSAPP_TEMPLATE_ORDER_STATUS,
    refund: environment.WHATSAPP_TEMPLATE_REFUND,
  }
  const templateLocales = {
    en: environment.WHATSAPP_TEMPLATE_LOCALE_EN,
    ckb: environment.WHATSAPP_TEMPLATE_LOCALE_CKB,
  }

  return {
    async sendTemplate(notification) {
      const response = await fetchImpl(
        `https://graph.facebook.com/${environment.WHATSAPP_GRAPH_API_VERSION}/${environment.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${environment.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: notification.recipient_phone,
            type: 'template',
            template: {
              name: templateNames[notification.notification_type],
              language: { code: templateLocales[notification.locale] },
              components: [{
                type: 'body',
                parameters: templateParameters(notification).map((text) => ({ type: 'text', text })),
              }],
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      )
      if (!response.ok) {
        const error = new Error(`WhatsApp API returned HTTP ${response.status}.`)
        error.code = `whatsapp_http_${response.status}`
        error.retryable = response.status >= 500 || response.status === 429
        throw error
      }
      return response.json()
    },
  }
}

export async function queueWhatsAppNotification(transaction, {
  orderId,
  statusEventId = null,
  recipientPhone,
  locale,
  notificationType,
  payload,
  idempotencyKey = statusEventId ? `status:${statusEventId}` : null,
}) {
  if (!recipientPhone) return
  if (!idempotencyKey) throw new Error('A WhatsApp notification idempotency key is required.')
  const normalizedPhone = normalizeWhatsAppPhone(recipientPhone)
  if (!normalizedPhone) throw new Error('A valid international WhatsApp phone number is required.')
  await transaction.query(
    `INSERT INTO whatsapp_notification_outbox
       (status_event_id, order_id, recipient_phone, locale, notification_type, idempotency_key, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [statusEventId, orderId, normalizedPhone, locale, notificationType, idempotencyKey, JSON.stringify(payload)],
  )
}

async function claimNotifications(database, limit) {
  return withWriteTransaction(database, async (transaction) => {
    const result = await transaction.query(
      `WITH due AS (
         SELECT id
         FROM whatsapp_notification_outbox
         WHERE status = 'pending' AND attempts < $1 AND next_attempt_at <= now()
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE whatsapp_notification_outbox AS queued
       SET attempts = queued.attempts + 1,
           next_attempt_at = now() + interval '5 minutes'
       FROM due
       WHERE queued.id = due.id
       RETURNING queued.id, queued.recipient_phone, queued.locale,
                 queued.notification_type, queued.payload, queued.attempts`,
      [maxAttempts, limit],
    )
    return result.rows
  })
}

async function markSent(database, id) {
  await database.query(
    `UPDATE whatsapp_notification_outbox
     SET status = 'sent', sent_at = now(), last_error = NULL
     WHERE id = $1 AND status = 'pending'`,
    [id],
  )
}

async function markFailed(database, notification, error) {
  const isFinalAttempt = notification.attempts >= maxAttempts || error?.retryable === false
  const delayMs = Math.min(retryBaseMs * (2 ** (notification.attempts - 1)), retryMaxMs)
  const safeCode = String(error?.code || error?.name || 'whatsapp_delivery_failed').slice(0, 100)
  await database.query(
    `UPDATE whatsapp_notification_outbox
     SET status = $2,
         next_attempt_at = CASE WHEN $2 = 'pending' THEN $3::timestamptz ELSE next_attempt_at END,
         last_error = $4
     WHERE id = $1 AND status = 'pending'`,
    [
      notification.id,
      isFinalAttempt ? 'failed' : 'pending',
      new Date(Date.now() + delayMs).toISOString(),
      safeCode,
    ],
  )
}

export function createWhatsAppNotificationWorker({
  getDatabase,
  transport,
  logger = console,
  pollIntervalMs = 10000,
}) {
  let timer
  let running = false
  let stopped = true

  async function processBatch() {
    if (running || stopped || !transport) return
    running = true
    try {
      const notifications = await claimNotifications(getDatabase(), 10)
      for (const notification of notifications) {
        try {
          await transport.sendTemplate(notification)
          await markSent(getDatabase(), notification.id)
        } catch (error) {
          await markFailed(getDatabase(), notification, error)
          reportServerError(error, 'whatsapp.delivery')
          logger.error('WhatsApp notification delivery failed.', {
            notificationId: notification.id,
            attempt: notification.attempts,
            code: String(error?.code || error?.name || 'whatsapp_delivery_failed').slice(0, 100),
          })
        }
      }
    } catch (error) {
      reportServerError(error, 'whatsapp.process_batch')
      logger.error('Unable to process WhatsApp notifications.', {
        name: String(error?.name || 'Error'),
      })
    } finally {
      running = false
    }
  }

  return {
    get configured() {
      return Boolean(transport)
    },
    start() {
      if (!transport || !stopped) return
      stopped = false
      void processBatch()
      timer = setInterval(() => void processBatch(), pollIntervalMs)
      timer.unref?.()
    },
    async stop() {
      stopped = true
      if (timer) clearInterval(timer)
      while (running) await new Promise((resolve) => setTimeout(resolve, 10))
    },
    processBatch,
  }
}
