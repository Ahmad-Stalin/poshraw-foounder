import { mkdir, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { encryptBackupStream } from './encrypted-backup.js'
import { postgresEnvironment } from './postgres-connection.mjs'

let incompleteBackup

function encryptionKey() {
  const key = process.env.BACKUP_ENCRYPTION_KEY || ''
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('Set BACKUP_ENCRYPTION_KEY to a private 64-character hexadecimal key.')
  }
  return Buffer.from(key, 'hex')
}

async function createBackup() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Set DATABASE_URL to the managed PostgreSQL database before creating a backup.')
  const key = encryptionKey()
  const backupDirectory = path.resolve(process.env.BACKUP_DIR || 'backups')
  await mkdir(backupDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
  const outputPath = path.join(backupDirectory, `poshraw-${timestamp}.dump.enc`)
  incompleteBackup = outputPath
  const child = spawn(process.env.PG_DUMP_PATH || 'pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-acl',
  ], {
    env: postgresEnvironment(databaseUrl),
    stdio: ['ignore', 'pipe', 'inherit'],
    windowsHide: true,
  })

  const [exitCode] = await Promise.all([
    new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    }),
    encryptBackupStream(child.stdout, outputPath, key),
  ])
  if (exitCode !== 0) throw new Error(`pg_dump failed with exit code ${exitCode}.`)
  incompleteBackup = undefined
  console.log(`Encrypted PostgreSQL backup created: ${outputPath}`)
}

createBackup().catch(async (error) => {
  if (incompleteBackup) {
    await rm(incompleteBackup, { force: true }).catch((cleanupError) => {
      console.error('Unable to remove the incomplete backup:', cleanupError.message)
    })
  }
  console.error('PostgreSQL backup failed:', error.message)
  process.exitCode = 1
})
