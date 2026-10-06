import nodemailer from 'nodemailer'
import { reportServerError } from './monitoring.js'
import { withWriteTransaction } from './transactions.js'

const maxAttempts = 8
const retryBaseMs = 60 * 1000
const retryMaxMs = 6 * 60 * 60 * 1000

const statusLabels = {
  en: {
    pending: 'Received',
    confirmed: 'Confirmed',
    processing: 'Being prepared',
    ready: 'Ready',
    shipped: 'Shipped',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
  ckb: {
    pending: 'وەرگیرا',
    confirmed: 'پشتڕاست کرایەوە',
    processing: 'ئامادە دەکرێت',
    ready: 'ئامادەیە',
    shipped: 'نێردراوە',
    completed: 'تەواو بوو',
    cancelled: 'هەڵوەشایەوە',
  },
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export function renderOrderNotification(notification) {
  const locale = notification.locale === 'ckb' ? 'ckb' : 'en'
  const isSorani = locale === 'ckb'
  const orderNumber = String(notification.payload.orderNumber)
  const status = statusLabels[locale][notification.payload.status] || notification.payload.status
  const isRefund = notification.notification_type === 'refund'
  const fulfillmentMethod = notification.payload.fulfillmentMethod
  const readyStatus = locale === 'ckb'
    ? fulfillmentMethod === 'pickup' ? 'ئامادەی وەرگرتنە' : 'ئامادەی گەیاندنە'
    : fulfillmentMethod === 'pickup' ? 'Ready for pickup' : 'Ready for delivery'
  const displayedStatus = notification.payload.status === 'ready' ? readyStatus : status
  const subject = isSorani
    ? `${isRefund ? 'گەڕاندنەوەی پارە' : 'نوێکاریی داواکاری'} ${orderNumber}`
    : `${notification.notification_type === 'order_received' ? 'Order received' : isRefund ? 'Refund update' : 'Order update'} ${orderNumber}`
  const heading = notification.notification_type === 'order_received'
    ? isSorani ? 'سوپاس بۆ داواکارییەکەت' : 'Thank you for your order'
    : isRefund
      ? isSorani ? 'گەڕاندنەوەی پارە تۆمار کرا' : 'Your refund has been recorded'
    : isSorani ? 'داواکارییەکەت نوێکرایەوە' : 'Your order has been updated'
  const lines = (notification.payload.items || []).map((item) => (
    `${item.name} · ${item.color} · ${item.size} × ${item.quantity}`
  ))
  const text = [
    heading,
    `${isSorani ? 'ژمارەی داواکاری' : 'Order number'}: ${orderNumber}`,
    ...(isRefund
      ? [`${isSorani ? 'بڕی گەڕاندنەوە' : 'Refund amount'}: ${notification.payload.amount}`]
      : [`${isSorani ? 'بارودۆخ' : 'Status'}: ${displayedStatus}`]),
    ...lines,
    isSorani
      ? 'فرۆشگا پێش جێبەجێکردنی داواکاری پەیوەندیت پێوە دەکات.'
      : isRefund ? 'Contact the store if you have questions about this refund.' : 'The store will contact you to confirm your order.',
  ].join('\n')
  const details = isRefund
      ? `<p>${escapeHtml(isSorani ? 'بڕی گەڕاندنەوە' : 'Refund amount')}: ${escapeHtml(notification.payload.amount)} ${escapeHtml(notification.payload.currency)}</p>`
      : `<p>${escapeHtml(isSorani ? 'بارودۆخ' : 'Status')}: ${escapeHtml(displayedStatus)}</p>`
  const footer = isRefund
      ? isSorani ? 'ئەگەر پرسیارت هەیە، پەیوەندی بە فرۆشگا بکە.' : 'Contact the store if you have questions about this refund.'
      : isSorani ? 'فرۆشگا پێش جێبەجێکردنی داواکاری پەیوەندیت پێوە دەکات.' : 'The store will contact you to confirm your order.'
  const html = `<main lang="${locale}" dir="${isSorani ? 'rtl' : 'ltr'}"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(isSorani ? 'ژمارەی داواکاری' : 'Order number')}: <strong>${escapeHtml(orderNumber)}</strong></p>${details}${lines.length ? `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}<p>${escapeHtml(footer)}</p></main>`

  return { subject, text, html }
}

export function createEmailTransport(environment = process.env) {
  if (!environment.SMTP_HOST) return null

  const port = Number(environment.SMTP_PORT || 587)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.')
  }
  if (!environment.SMTP_FROM || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment.SMTP_FROM)) {
    throw new Error('SMTP_FROM must be a valid sender email address when SMTP is configured.')
  }
  if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD)) {
    throw new Error('Set both SMTP_USER and SMTP_PASSWORD, or leave both empty.')
  }

  return {
    from: environment.SMTP_FROM,
    client: nodemailer.createTransport({
      host: environment.SMTP_HOST,
      port,
      secure: environment.SMTP_SECURE === 'true',
      ...(environment.SMTP_USER ? {
        auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD },
      } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    }),
  }
}

export async function queueOrderEmail(transaction, {
  orderId,
  statusEventId = null,
  recipientEmail,
  locale,
  notificationType,
  payload,
  idempotencyKey = statusEventId ? `status:${statusEventId}` : null,
}) {
  if (!recipientEmail) return
  if (!idempotencyKey) throw new Error('An email notification idempotency key is required.')
  await transaction.query(
    `INSERT INTO email_notification_outbox
       (status_event_id, order_id, recipient_email, locale, notification_type, idempotency_key, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [statusEventId, orderId, recipientEmail, locale, notificationType, idempotencyKey, JSON.stringify(payload)],
  )
}

async function claimNotifications(database, limit) {
  return withWriteTransaction(database, async (transaction) => {
    const result = await transaction.query(
      `WITH due AS (
         SELECT id
         FROM email_notification_outbox
         WHERE status = 'pending' AND attempts < $1 AND next_attempt_at <= now()
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE email_notification_outbox AS queued
       SET attempts = queued.attempts + 1,
           next_attempt_at = now() + interval '5 minutes'
       FROM due
       WHERE queued.id = due.id
       RETURNING queued.id, queued.recipient_email, queued.locale,
                 queued.notification_type, queued.payload, queued.attempts`,
      [maxAttempts, limit],
    )
    return result.rows
  })
}

async function markSent(database, id) {
  await database.query(
    `UPDATE email_notification_outbox
     SET status = 'sent', sent_at = now(), last_error = NULL
     WHERE id = $1 AND status = 'pending'`,
    [id],
  )
}

async function markFailed(database, notification, error) {
  const isFinalAttempt = notification.attempts >= maxAttempts
  const delayMs = Math.min(retryBaseMs * (2 ** (notification.attempts - 1)), retryMaxMs)
  const safeCode = String(error?.code || error?.name || 'email_delivery_failed').slice(0, 100)
  await database.query(
    `UPDATE email_notification_outbox
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

export function createEmailNotificationWorker({
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
          const content = renderOrderNotification(notification)
          await transport.client.sendMail({
            from: transport.from,
            to: notification.recipient_email,
            ...content,
          })
          await markSent(getDatabase(), notification.id)
        } catch (error) {
          await markFailed(getDatabase(), notification, error)
          reportServerError(error, 'email.delivery')
          logger.error('Order email delivery failed.', {
            notificationId: notification.id,
            attempt: notification.attempts,
            code: String(error?.code || error?.name || 'email_delivery_failed').slice(0, 100),
          })
        }
      }
    } catch (error) {
      reportServerError(error, 'email.process_batch')
      logger.error('Unable to process order email notifications.', {
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
      await transport?.client.close()
    },
    processBatch,
  }
}
