import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { createRateLimiter } from '../server/rate-limits.js'

test('rate limits are shared across server instances and store only hashed client keys', async () => {
  const database = new PGlite()
  await database.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  const getDatabase = () => database

  const createServer = async () => {
    const app = express()
    app.get('/limited', createRateLimiter(getDatabase, {
      scope: 'test',
      limit: 2,
      windowMs: 60_000,
      message: 'Too many attempts.',
    }), (_request, response) => response.sendStatus(204))
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
    })
    return { server, url: `http://127.0.0.1:${server.address().port}/limited` }
  }

  const first = await createServer()
  const second = await createServer()
  try {
    assert.equal((await fetch(first.url)).status, 204)
    assert.equal((await fetch(second.url)).status, 204)
    const limited = await fetch(first.url)
    assert.equal(limited.status, 429)
    assert.ok(Number(limited.headers.get('retry-after')) > 0)

    const rows = await database.query('SELECT bucket_hash FROM api_rate_limit_windows')
    assert.equal(rows.rows.length, 1)
    assert.match(rows.rows[0].bucket_hash, /^[a-f0-9]{64}$/)
  } finally {
    await Promise.all([first.server, second.server].map((server) => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })))
    await database.close()
  }
})