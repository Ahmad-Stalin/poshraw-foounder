import { timingSafeEqual } from 'node:crypto'
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from '@prometheus-io/client'

const registry = new Registry()
const safeErrorOperations = new Set([
  'accounting.correction',
  'accounting.entry',
  'accounting.order_payment',
  'accounting.order_refund',
  'accounting.report',
  'admin.analytics',
  'admin.image_update',
  'admin.login',
  'admin.logout',
  'admin.order_status_update',
  'admin.orders',
  'admin.product_update',
  'admin.products',
  'admin.session',
  'admin.setup',
  'admin.setup_status',
  'admin.variant_update',
  'analytics.cleanup',
  'analytics.record',
  'application.startup',
  'catalog.load',
  'email.delivery',
  'email.process_batch',
  'health.database',
  'health.notifications',
  'http.unhandled',
  'orders.create',
])
const clientErrorKinds = new Set(['react_boundary', 'unhandled_rejection', 'window_error'])

collectDefaultMetrics({ register: registry, prefix: 'poshraw_' })

const requests = new Counter({
  name: 'poshraw_http_requests_total',
  help: 'Completed HTTP requests handled by the application.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
})

const requestDuration = new Histogram({
  name: 'poshraw_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
})

const serverErrors = new Counter({
  name: 'poshraw_application_errors_total',
  help: 'Handled application errors, grouped by fixed operation name.',
  labelNames: ['operation'],
  registers: [registry],
})

const clientErrors = new Counter({
  name: 'poshraw_browser_errors_total',
  help: 'Privacy-safe browser error counts, grouped by fixed error kind.',
  labelNames: ['kind'],
  registers: [registry],
})

const browserErrorRequests = new Counter({
  name: 'poshraw_browser_error_reports_total',
  help: 'Privacy-safe browser error reporting API requests by outcome.',
  labelNames: ['outcome'],
  registers: [registry],
})

export function routeLabel(request) {
  const route = request.route?.path
  return typeof route === 'string' && route.startsWith('/') && route.length <= 100
    ? route
    : '/unmatched'
}

export function isMetricsAuthorizationValid(header, token) {
  if (!token || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const supplied = Buffer.from(header.slice(7))
  const expected = Buffer.from(token)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function recordRequest(request, response, startedAt) {
  if (request.path === '/internal/metrics') return
  response.once('finish', () => {
    const method = /^[A-Z]{1,12}$/.test(request.method) ? request.method : 'OTHER'
    const route = routeLabel(request)
    const statusCode = response.statusCode >= 100 && response.statusCode <= 599
      ? String(response.statusCode)
      : '500'
    requests.inc({ method, route, status_code: statusCode })
    requestDuration.observe({ method, route }, (performance.now() - startedAt) / 1000)
  })
}

export function reportServerError(_error, operation) {
  serverErrors.inc({ operation: safeErrorOperations.has(operation) ? operation : 'other' })
}

export function recordClientError(kind) {
  if (!clientErrorKinds.has(kind)) {
    browserErrorRequests.inc({ outcome: 'invalid' })
    return false
  }
  clientErrors.inc({ kind })
  browserErrorRequests.inc({ outcome: 'accepted' })
  return true
}

export function recordClientErrorRejection(outcome) {
  browserErrorRequests.inc({
    outcome: ['forbidden', 'rate_limited'].includes(outcome) ? outcome : 'invalid',
  })
}

export async function metricsText() {
  return registry.metrics()
}

export function metricsContentType() {
  return registry.contentType
}

export { clientErrorKinds }
