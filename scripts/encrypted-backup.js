import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { appendFile, open, stat } from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

export const encryptedBackupHeader = Buffer.from('POSHRAW1')

export async function encryptBackupStream(input, outputPath, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const output = createWriteStream(outputPath, { flags: 'wx', mode: 0o600 })
  output.write(Buffer.concat([encryptedBackupHeader, iv]))
  await pipeline(input, cipher, output)
  await appendFile(outputPath, cipher.getAuthTag())
}

export async function decryptBackupFile(sourcePath, outputPath, key) {
  const backupSize = (await stat(sourcePath)).size
  if (backupSize < 36) throw new Error('Backup file is too small to be valid.')

  const fileHandle = await open(sourcePath, 'r')
  let prefix
  let authTag
  try {
    prefix = Buffer.alloc(20)
    authTag = Buffer.alloc(16)
    await fileHandle.read(prefix, 0, prefix.length, 0)
    await fileHandle.read(authTag, 0, authTag.length, backupSize - authTag.length)
  } finally {
    await fileHandle.close()
  }
  if (!prefix.subarray(0, encryptedBackupHeader.length).equals(encryptedBackupHeader)) {
    throw new Error('Backup format is invalid or unsupported.')
  }

  const decipher = createDecipheriv('aes-256-gcm', key, prefix.subarray(encryptedBackupHeader.length))
  decipher.setAuthTag(authTag)
  await pipeline(
    createReadStream(sourcePath, { start: prefix.length, end: backupSize - authTag.length - 1 }),
    decipher,
    createWriteStream(outputPath, { flags: 'wx', mode: 0o600 }),
  )
}
