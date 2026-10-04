export function postgresEnvironment(databaseUrl) {
  let connection
  try {
    connection = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.')
  }
  if (!['postgres:', 'postgresql:'].includes(connection.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql scheme.')
  }

  const databaseName = decodeURIComponent(connection.pathname.replace(/^\/+/, ''))
  if (!connection.hostname || !databaseName) {
    throw new Error('DATABASE_URL must include a database host and name.')
  }
  const configuredSslMode = connection.searchParams.get('sslmode')
    || process.env.DATABASE_SSL
    || 'verify-full'

  const environment = { ...process.env }
  delete environment.DATABASE_URL
  delete environment.BACKUP_ENCRYPTION_KEY

  return {
    ...environment,
    PGHOST: connection.hostname,
    PGPORT: connection.port || '5432',
    PGUSER: decodeURIComponent(connection.username),
    PGPASSWORD: decodeURIComponent(connection.password),
    PGDATABASE: databaseName,
    PGSSLMODE: configuredSslMode === 'require' ? 'verify-full' : configuredSslMode,
  }
}
