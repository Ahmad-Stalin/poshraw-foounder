import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import express from 'express'
import { PGlite } from '@electric-sql/pglite'
import { registerAdminRoutes } from '../server/admin.js'

test('admin setup claim is exclusive across concurrent database requests', async () => {
  const database = new PGlite()
  const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8')
  await database.exec(schema)
  await database.exec(schema)

  try {
    const claimSetup = () => database.query(
      `UPDATE admin_setup_state
       SET setup_complete = true
       WHERE setup_id = 1 AND setup_complete = false
       RETURNING setup_id`,
    )
    const results = await Promise.all([claimSetup(), claimSetup()])
    assert.equal(results.reduce((claims, result) => claims + result.rows.length, 0), 1)
  } finally {
    await database.close()
  }
})

test('admin setup protects product, photo, inventory, and order updates', async () => {
  const database = new PGlite()
  await database.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'))
  await database.exec(await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8'))
  const orderResult = await database.query('INSERT INTO orders DEFAULT VALUES RETURNING id')
  const orderId = orderResult.rows[0].id
  const partialOrderResult = await database.query('INSERT INTO orders DEFAULT VALUES RETURNING id')
  const partialOrderId = partialOrderResult.rows[0].id
  const repaymentOrderResult = await database.query('INSERT INTO orders DEFAULT VALUES RETURNING id')
  const repaymentOrderId = repaymentOrderResult.rows[0].id
  await database.query(
    'UPDATE orders SET subtotal_minor = 125000, delivery_minor = 0, total_minor = 125000 WHERE id = $1',
    [orderId],
  )
  await database.query(
    'UPDATE orders SET subtotal_minor = 150000, delivery_minor = 0, total_minor = 150000 WHERE id = $1',
    [partialOrderId],
  )
  await database.query(
    'UPDATE orders SET subtotal_minor = 150000, delivery_minor = 0, total_minor = 150000 WHERE id = $1',
    [repaymentOrderId],
  )
  const pooledDatabase = {
    query: (...args) => database.query(...args),
    transaction: async (operation) => {
      await database.exec('BEGIN')
      try {
        const result = await operation({ query: (...args) => database.query(...args) })
        await database.exec('COMMIT')
        return result
      } catch (error) {
        await database.exec('ROLLBACK')
        throw error
      }
    },
  }

  const app = express()
  app.use(express.json())
  registerAdminRoutes(app, {
    getDatabase: () => pooledDatabase,
    isProduction: false,
    setupToken: 'test-only-bootstrap-token-7dbf2b8a',
    configuredOrigins: ['http://localhost:5173'],
  })

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const origin = 'http://localhost:5173'
  const request = (path, { method = 'GET', body, cookie, requestOrigin = origin } = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Origin: requestOrigin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  try {
    assert.equal((await request('/api/admin/products')).status, 401)
    assert.equal((await request('/api/admin/accounting?from=2026-10-01&to=2026-10-31')).status, 401)
    assert.equal((await request('/api/admin/setup', {
      method: 'POST',
      requestOrigin: 'https://attacker.example',
      body: { setupToken: 'test-only-bootstrap-token-7dbf2b8a', email: 'owner@example.com', password: 'test-password-strong-123' },
    })).status, 403)
    assert.equal((await request('/api/admin/setup', {
      method: 'POST',
      body: { setupToken: 'wrong-token', email: 'owner@example.com', password: 'test-password-strong-123' },
    })).status, 403)

    const setupResponse = await request('/api/admin/setup', {
      method: 'POST',
      body: { setupToken: 'test-only-bootstrap-token-7dbf2b8a', email: 'Owner@Example.com', password: 'test-password-strong-123' },
    })
    assert.equal(setupResponse.status, 201)
    const setupBody = await setupResponse.json()
    assert.equal(setupBody.admin.email, 'owner@example.com')
    const cookie = setupResponse.headers.get('set-cookie')?.split(';')[0]
    assert.ok(cookie)

    const today = new Date().toISOString().slice(0, 10)
    const paymentResponse = await request(`/api/admin/orders/${orderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 125000, paymentMethod: 'cash' },
    })
    assert.equal(paymentResponse.status, 201)
    assert.equal((await paymentResponse.json()).payment.paymentStatus, 'paid')
    assert.equal((await request(`/api/admin/orders/${orderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 125000, paymentMethod: 'cash' },
    })).status, 409)
    const partialPayment = await request(`/api/admin/orders/${partialOrderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 50000, paymentMethod: 'cash' },
    })
    assert.equal(partialPayment.status, 201)
    assert.equal((await partialPayment.json()).payment.paymentStatus, 'partially_paid')
    assert.equal((await request(`/api/admin/orders/${partialOrderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 100001, paymentMethod: 'bank_transfer' },
    })).status, 400)
    const finalPartialPayment = await request(`/api/admin/orders/${partialOrderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 100000, paymentMethod: 'bank_transfer' },
    })
    assert.equal(finalPartialPayment.status, 201)
    assert.equal((await finalPartialPayment.json()).payment.paymentStatus, 'paid')

    const expenseResponse = await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'expense',
        paymentMethod: 'bank_transfer',
        category: 'Utilities',
        description: 'October electricity bill',
        amountMinor: 25000,
        occurredAt: today,
      },
    })
    assert.equal(expenseResponse.status, 201)
    const otherIncome = await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'other_income',
        paymentMethod: 'cash',
        category: 'Other income',
        description: 'Shop adjustment',
        amountMinor: 5000,
        occurredAt: today,
      },
    })
    assert.equal(otherIncome.status, 201)
    assert.equal((await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'expense',
        paymentMethod: 'cash',
        category: 'Rent',
        description: 'Future rent',
        amountMinor: 100,
        occurredAt: '2999-01-01',
      },
    })).status, 400)

    const accountingResponse = await request(`/api/admin/accounting?from=${today}&to=${today}`, { cookie })
    assert.equal(accountingResponse.status, 200)
    const accounting = await accountingResponse.json()
    assert.equal(accounting.incomeMinor, 280000)
    assert.equal(accounting.expensesMinor, 25000)
    assert.equal(accounting.netProfitMinor, 255000)
    assert.equal(accounting.balances.cash, 180000)
    assert.equal(accounting.balances.bank_transfer, 75000)
    assert.equal(accounting.entries.length, 5)

    const payment = await database.query('SELECT status, amount_minor FROM payments WHERE order_id = $1', [orderId])
    assert.equal(payment.rows[0].status, 'succeeded')
    assert.equal(Number(payment.rows[0].amount_minor), 125000)
    const orderPayment = await database.query('SELECT payment_status FROM orders WHERE id = $1', [orderId])
    assert.equal(orderPayment.rows[0].payment_status, 'paid')

    const partialRefundResponse = await request(`/api/admin/orders/${partialOrderId}/refund`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 30000, paymentMethod: 'cash' },
    })
    assert.equal(partialRefundResponse.status, 201)
    assert.equal((await partialRefundResponse.json()).refund.paymentStatus, 'partially_refunded')
    const afterPartialRefund = await (await request(`/api/admin/accounting?from=${today}&to=${today}`, { cookie })).json()
    assert.equal(afterPartialRefund.incomeMinor, 250000)
    assert.equal(afterPartialRefund.refundsMinor, 30000)
    assert.equal(afterPartialRefund.netProfitMinor, 225000)
    const restOfRefund = await request(`/api/admin/orders/${partialOrderId}/refund`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 120000, paymentMethod: 'cash' },
    })
    assert.equal(restOfRefund.status, 201)
    assert.equal((await restOfRefund.json()).refund.paymentStatus, 'refunded')
    const refundResponse = await request(`/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 125000, paymentMethod: 'cash' },
    })
    assert.equal(refundResponse.status, 201)
    assert.equal((await refundResponse.json()).refund.paymentStatus, 'refunded')
    assert.equal((await request(`/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 1, paymentMethod: 'cash' },
    })).status, 409)
    const afterRefund = await (await request(`/api/admin/accounting?from=${today}&to=${today}`, { cookie })).json()
    assert.equal(afterRefund.incomeMinor, 5000)
    assert.equal(afterRefund.refundsMinor, 275000)
    assert.equal(afterRefund.netProfitMinor, -20000)
    assert.equal(afterRefund.balances.cash, -95000)

    const openingCash = await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'opening_balance',
        paymentMethod: 'cash',
        category: 'Opening cash',
        description: 'Starting cash float',
        amountMinor: 10000,
        occurredAt: today,
      },
    })
    assert.equal(openingCash.status, 201)
    const openingCashId = (await openingCash.json()).entry.id
    assert.equal((await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'opening_balance',
        paymentMethod: 'cash',
        category: 'Opening cash',
        description: 'Duplicate starting cash float',
        amountMinor: 5000,
        occurredAt: today,
      },
    })).status, 409)
    const openingBank = await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'opening_balance',
        paymentMethod: 'bank_transfer',
        category: 'Opening bank',
        description: 'Starting bank balance',
        amountMinor: 20000,
        occurredAt: today,
      },
    })
    assert.equal(openingBank.status, 201)
    const transfer = await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'transfer',
        paymentMethod: 'cash',
        transferTo: 'bank_transfer',
        category: 'Cash deposit',
        description: 'Move cash to bank',
        amountMinor: 4000,
        occurredAt: today,
      },
    })
    assert.equal(transfer.status, 201)
    const transferId = (await transfer.json()).entry.id
    let afterTransfer = await (await request(`/api/admin/accounting?from=${today}&to=${today}`, { cookie })).json()
    assert.equal(afterTransfer.balances.cash, -89000)
    assert.equal(afterTransfer.balances.bank_transfer, 99000)
    assert.equal(afterTransfer.incomeMinor, 5000)
    assert.equal(afterTransfer.netProfitMinor, -20000)
    assert.equal((await request(`/api/admin/accounting/entries/${transferId}/correct`, {
      method: 'POST',
      cookie,
      body: { description: 'Reverse mistaken transfer' },
    })).status, 201)
    afterTransfer = await (await request(`/api/admin/accounting?from=${today}&to=${today}`, { cookie })).json()
    assert.equal(afterTransfer.balances.cash, -85000)
    assert.equal(afterTransfer.balances.bank_transfer, 95000)
    assert.equal(afterTransfer.incomeMinor, 5000)
    assert.equal(afterTransfer.netProfitMinor, -20000)
    assert.equal((await request(`/api/admin/accounting/entries/${openingCashId}/correct`, {
      method: 'POST',
      cookie,
      body: { description: 'Reverse incorrect opening cash amount' },
    })).status, 201)
    afterTransfer = await (await request(`/api/admin/accounting?from=${today}&to=${today}`, { cookie })).json()
    assert.equal(afterTransfer.balances.cash, -95000)
    assert.equal(afterTransfer.balances.bank_transfer, 95000)
    assert.equal(afterTransfer.incomeMinor, 5000)
    assert.equal(afterTransfer.netProfitMinor, -20000)
    const formulaEntry = await request('/api/admin/accounting/entries', {
      method: 'POST',
      cookie,
      body: {
        entryType: 'expense',
        paymentMethod: 'cash',
        category: '=1+1',
        description: 'CSV formula safety check',
        amountMinor: 1000,
        occurredAt: today,
      },
    })
    assert.equal(formulaEntry.status, 201)
    const formulaId = (await formulaEntry.json()).entry.id
    const csvResponse = await request(`/api/admin/accounting?from=${today}&to=${today}&format=csv`, { cookie })
    assert.equal(csvResponse.status, 200)
    assert.match(await csvResponse.text(), /"'=1\+1"/)
    assert.equal((await request(`/api/admin/accounting/entries/${formulaId}/correct`, {
      method: 'POST',
      cookie,
      body: { description: 'Reverse CSV safety test entry' },
    })).status, 201)
    const initialReceipt = await request(`/api/admin/orders/${repaymentOrderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 50000, paymentMethod: 'cash' },
    })
    assert.equal(initialReceipt.status, 201)
    const returnReceipt = await request(`/api/admin/orders/${repaymentOrderId}/refund`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 50000, paymentMethod: 'cash' },
    })
    assert.equal(returnReceipt.status, 201)
    assert.equal((await returnReceipt.json()).refund.paymentStatus, 'partially_paid')
    const repaidBalance = await request(`/api/admin/orders/${repaymentOrderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 100000, paymentMethod: 'bank_transfer' },
    })
    assert.equal(repaidBalance.status, 201)
    assert.equal((await repaidBalance.json()).payment.paymentStatus, 'partially_paid')
    const completedRepayment = await request(`/api/admin/orders/${repaymentOrderId}/payment`, {
      method: 'POST',
      cookie,
      body: { amountMinor: 50000, paymentMethod: 'bank_transfer' },
    })
    assert.equal(completedRepayment.status, 201)
    assert.equal((await completedRepayment.json()).payment.paymentStatus, 'paid')

    const repeatedSetup = await request('/api/admin/setup', {
      method: 'POST',
      body: { setupToken: 'test-only-bootstrap-token-7dbf2b8a', email: 'other@example.com', password: 'test-password-strong-123' },
    })
    assert.equal(repeatedSetup.status, 409)

    const productResponse = await request('/api/admin/products', { cookie })
    assert.equal(productResponse.status, 200)
    const product = (await productResponse.json()).products[0]
    const translations = structuredClone(product.translations)
    translations.en.name = 'Admin test product'
    const updateProduct = await request(`/api/admin/products/${product.id}`, {
      method: 'PUT',
      cookie,
      body: { stageCode: product.stageCode, status: product.status, priceMinor: 1200000, translations },
    })
    assert.equal(updateProduct.status, 200)

    const updateImages = await request(`/api/admin/products/${product.id}/images`, {
      method: 'PUT',
      cookie,
      body: { images: [{ url: 'https://images.example.test/uniform.webp', altText: 'School uniform' }] },
    })
    assert.equal(updateImages.status, 200)

    const variant = product.variants[0]
    const updateVariant = await request(`/api/admin/variants/${variant.id}`, {
      method: 'PATCH',
      cookie,
      body: { priceMinor: 1500000, trackInventory: true, stockOnHand: 7 },
    })
    assert.equal(updateVariant.status, 200)
    const inventory = await database.query('SELECT quantity_delta FROM inventory_movements WHERE variant_id = $1', [variant.id])
    assert.equal(inventory.rows[0].quantity_delta, 7)

    const updateOrder = await request(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      cookie,
      body: { status: 'confirmed' },
    })
    assert.equal(updateOrder.status, 200)
    const audit = await database.query('SELECT actor_admin_id, new_status FROM order_status_events WHERE order_id = $1', [orderId])
    assert.equal(audit.rows[0].actor_admin_id, setupBody.admin.id)
    assert.equal(audit.rows[0].new_status, 'confirmed')

    assert.equal((await request('/api/admin/logout', { method: 'POST', cookie })).status, 200)
    assert.equal((await request('/api/admin/products', { cookie })).status, 401)

    const loginResponse = await request('/api/admin/login', {
      method: 'POST',
      body: { email: 'owner@example.com', password: 'test-password-strong-123' },
    })
    assert.equal(loginResponse.status, 200)
    assert.ok(loginResponse.headers.get('set-cookie'))
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await database.close()
  }
})