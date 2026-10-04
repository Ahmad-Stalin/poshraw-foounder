import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const secretDirectory = path.join(projectRoot, 'secrets')
const secretPath = path.join(secretDirectory, 'metrics_bearer_token')
const envPath = path.join(projectRoot, '.env.monitoring')

await mkdir(secretDirectory, { recursive: true })

try {
  await readFile(secretPath)
  throw new Error(`${path.relative(projectRoot, secretPath)} already exists; refusing to replace credentials.`)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

try {
  await readFile(envPath)
  throw new Error('.env.monitoring already exists; refusing to replace credentials.')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const metricsToken = randomBytes(32).toString('hex')
const grafanaPassword = randomBytes(24).toString('base64url')
const secretHandle = await open(secretPath, 'wx', 0o600)
try {
  await secretHandle.writeFile(metricsToken, 'utf8')
} finally {
  await secretHandle.close()
}

try {
  const envHandle = await open(envPath, 'wx', 0o600)
  try {
    await envHandle.writeFile([
      `GRAFANA_ADMIN_PASSWORD=${grafanaPassword}`,
      'ALERT_SMTP_HOST=mailpit:1025',
      'ALERT_SMTP_FROM=poshraw-alerts@localhost',
      'ALERT_SMTP_USERNAME=',
      'ALERT_SMTP_PASSWORD=',
      'ALERT_SMTP_REQUIRE_TLS=false',
      'ALERT_EMAIL_TO=operator@localhost',
      '',
    ].join('\n'), 'utf8')
  } finally {
    await envHandle.close()
  }
} catch (error) {
  await (await import('node:fs/promises')).rm(secretPath, { force: true })
  throw error
}

console.log('Monitoring credentials created in ignored local files:')
console.log('- .env.monitoring (Grafana password and alert delivery settings)')
console.log('- secrets/metrics_bearer_token (shared Docker secret for the API and Prometheus)')
console.log('Default alert emails are captured locally by Mailpit. Configure external SMTP and an operator email before production use.')
