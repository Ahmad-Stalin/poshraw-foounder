import { createReadStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { decryptBackupFile } from './encrypted-backup.js'
import { postgresEnvironment } from './postgres-connection.mjs'

async function restoreBackup() {
  const backupPath = process.argv[2]
  if (!backupPath) throw new Error('Usage: npm run restore -- <encrypted-backup-file>')
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Set DATABASE_URL to an empty PostgreSQL database for the restore.')
  const keyText = process.env.BACKUP_ENCRYPTION_KEY || ''
  if (!/^[a-f0-9]{64}$/i.test(keyText)) {
    throw new Error('Set BACKUP_ENCRYPTION_KEY to the same private 64-character hexadecimal key used for the backup.')
  }

  const sourcePath = path.resolve(backupPath)
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'poshraw-restore-'))
  const temporaryDump = path.join(temporaryDirectory, 'restore.dump')
  try {
    await decryptBackupFile(sourcePath, temporaryDump, Buffer.from(keyText, 'hex'))

    const child = spawn(process.env.PG_RESTORE_PATH || 'pg_restore', [
      '--exit-on-error',
      '--no-owner',
      '--no-acl',
    ], {
      env: postgresEnvironment(databaseUrl),
      stdio: ['pipe', 'inherit', 'inherit'],
      windowsHide: true,
    })
    const [exitCode] = await Promise.all([
      new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('close', resolve)
      }),
      pipeline(createReadStream(temporaryDump), child.stdin),
    ])
    if (exitCode !== 0) throw new Error(`pg_restore failed with exit code ${exitCode}.`)
    console.log('Encrypted PostgreSQL backup restored successfully.')
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

restoreBackup().catch((error) => {
  console.error('PostgreSQL restore failed:', error.message)
  process.exitCode = 1
})
