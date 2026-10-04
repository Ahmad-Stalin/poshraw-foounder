import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isMetricsAuthorizationValid,
  metricsText,
  recordClientError,
  recordRequest,
  reportServerError,
  routeLabel,
} from '../server/monitoring.js'

test('metrics authorization requires an exact bearer token match', () => {
  assert.equal(isMetricsAuthorizationValid('Bearer 0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'), true)
  assert.equal(isMetricsAuthorizationValid('Bearer incorrect-token', '0123456789abcdef0123456789abcdef'), false)
  assert.equal(isMetricsAuthorizationValid('Basic 0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'), false)
  assert.equal(isMetricsAuthorizationValid('Bearer token', ''), false)
})

test('metric route labels avoid raw URLs and dynamic identifiers', () => {
  assert.equal(routeLabel({ route: { path: '/api/orders/:id' } }), '/api/orders/:id')
  assert.equal(routeLabel({ path: '/api/orders/secret-id', route: undefined }), '/unmatched')
  assert.equal(routeLabel({ route: { path: `/${'x'.repeat(101)}` } }), '/unmatched')
})

test('application metrics capture requests and errors without request details', async () => {
  const finishedListeners = []
  const response = {
    statusCode: 500,
    once: (_event, listener) => finishedListeners.push(listener),
  }
  recordRequest({
    path: '/api/orders/customer-secret',
    method: 'POST',
    route: { path: '/api/orders/:id' },
  }, response, performance.now() - 25)
  for (const listener of finishedListeners) listener()
  reportServerError(new Error('customer private information'), 'orders.create')
  reportServerError(new Error('untrusted label'), 'email:customer@example.com')
  assert.equal(recordClientError('window_error'), true)
  assert.equal(recordClientError('customer@example.com'), false)

  const output = await metricsText()
  assert.match(output, /poshraw_http_requests_total\{method="POST",route="\/api\/orders\/:id",status_code="500"\} 1/)
  assert.match(output, /poshraw_application_errors_total\{operation="orders\.create"\} 1/)
  assert.match(output, /poshraw_application_errors_total\{operation="other"\} 1/)
  assert.match(output, /poshraw_browser_errors_total\{kind="window_error"\} 1/)
  assert.doesNotMatch(output, /customer-secret|customer@example\.com|private information/)
})
