import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import os from 'node:os'
import path from 'node:path'
import { decryptBackupFile, encryptBackupStream } from '../scripts/encrypted-backup.js'
import { postgresEnvironment } from '../scripts/postgres-connection.mjs'

test('backup database connection keeps credentials out of child connection strings', () => {
  const environment = postgresEnvironment(
    'postgresql://store%40owner:p%3Assword@db.example.test:5433/shop%20orders?sslmode=require',
  )
  assert.equal(environment.PGHOST, 'db.example.test')
  assert.equal(environment.PGPORT, '5433')
  assert.equal(environment.PGUSER, 'store@owner')
  assert.equal(environment.PGPASSWORD, 'p:ssword')
  assert.equal(environment.PGDATABASE, 'shop orders')
  assert.equal(environment.PGSSLMODE, 'verify-full')
  assert.equal(Object.hasOwn(environment, 'DATABASE_URL'), false)
  assert.equal(Object.hasOwn(environment, 'BACKUP_ENCRYPTION_KEY'), false)
})

test('backup connection rejects non-PostgreSQL URLs', () => {
  assert.throws(
    () => postgresEnvironment('https://example.test/database'),
    /postgres or postgresql scheme/,
  )
})

test('encrypted database backups round-trip and reject tampering', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'poshraw-backup-test-'))
  const key = randomBytes(32)
  const original = Buffer.from('fixture PostgreSQL custom-format dump')
  const backupPath = path.join(directory, 'database.dump.enc')
  const restoredPath = path.join(directory, 'restored.dump')

  try {
    await encryptBackupStream(Readable.from([original]), backupPath, key)
    await decryptBackupFile(backupPath, restoredPath, key)
    assert.deepEqual(await readFile(restoredPath), original)

    const tamperedPath = path.join(directory, 'tampered.dump.enc')
    const encrypted = await readFile(backupPath)
    encrypted[encrypted.length - 1] ^= 1
    await writeFile(tamperedPath, encrypted)
    await assert.rejects(
      decryptBackupFile(tamperedPath, path.join(directory, 'tampered.dump'), key),
      /authenticate|bad decrypt/i,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
