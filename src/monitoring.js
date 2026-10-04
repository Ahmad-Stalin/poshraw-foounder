const reportedKinds = new Set()

export function reportClientError(kind) {
  if (!['react_boundary', 'unhandled_rejection', 'window_error'].includes(kind)) return
  if (reportedKinds.has(kind)) return
  reportedKinds.add(kind)
  window.setTimeout(() => reportedKinds.delete(kind), 60_000)
  void fetch('/api/monitoring/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
    keepalive: true,
  }).catch(() => {
    console.warn('Unable to send privacy-safe browser error metric.')
  })
}

window.addEventListener('error', () => reportClientError('window_error'))
window.addEventListener('unhandledrejection', () => reportClientError('unhandled_rejection'))
