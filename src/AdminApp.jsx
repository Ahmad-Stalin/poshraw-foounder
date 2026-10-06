import { useEffect, useState } from 'react'
import { ArrowLeft, Archive, BarChart3, Box, ImagePlus, LogOut, PackageCheck, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import './Admin.css'

const orderStatusOptions = ['pending', 'confirmed', 'processing', 'ready', 'shipped', 'completed', 'cancelled']

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Request failed')
  return result
}

function currencyScale(currency) {
  const fractionDigits = new Intl.NumberFormat('en-IQ', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
  return 10 ** fractionDigits
}

function amountToInput(amountMinor, currency) {
  return amountMinor === null || amountMinor === undefined ? '' : String(Number(amountMinor) / currencyScale(currency))
}

function inputToAmount(value, currency) {
  if (value.trim() === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return undefined
  const minorAmount = Math.round(amount * currencyScale(currency))
  return Number.isSafeInteger(minorAmount) ? minorAmount : undefined
}

function statusLabel(status) {
  return status.replaceAll('_', ' ')
}

function AuthScreen({ setup, onLogin, onSetup, initialError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(initialError || '')
  const [busy, setBusy] = useState(false)
  const creatingAdmin = setup.setupRequired

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (creatingAdmin) {
        if (password !== confirmation) throw new Error('Passwords do not match.')
        await onSetup({ setupToken, email, password })
      } else {
        await onLogin({ email, password })
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-auth-page">
      <a className="admin-brand" href="/">
        <span>POSHRAW<span>.</span>Co</span>
        <small>STORE ADMIN</small>
      </a>
      <section className="admin-auth-panel">
        <div className="admin-auth-icon"><ShieldCheck size={22} /></div>
        <p className="admin-eyebrow">{creatingAdmin ? 'SECURE INITIAL SETUP' : 'PRIVATE STORE ACCESS'}</p>
        <h1>{creatingAdmin ? 'Create the owner account' : 'Sign in to manage the store'}</h1>
        <p className="admin-muted">{creatingAdmin ? 'The first admin account is protected by a one-time server setup token.' : 'Catalog, inventory and orders are available to authorized staff only.'}</p>

        {creatingAdmin && !setup.setupEnabled ? (
          <div className="admin-notice" role="status">
            Set <code>POSHRAW_ADMIN_SETUP_TOKEN</code> in your local `.env` file, restart the server, then reload this page.
          </div>
        ) : (
          <form className="admin-auth-form" onSubmit={submit}>
            {creatingAdmin && <label>One-time setup token<input type="password" autoComplete="off" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} required /></label>}
            <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={creatingAdmin ? 'new-password' : 'current-password'} minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {creatingAdmin && <label>Confirm password<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>}
            {error && <p className="admin-error" role="alert">{error}</p>}
            <button className="admin-primary-button" type="submit" disabled={busy || (creatingAdmin && !setup.setupEnabled)}>{busy ? 'Please wait...' : creatingAdmin ? 'Create owner account' : 'Sign in'}</button>
          </form>
        )}
        {!creatingAdmin && error && <p className="admin-error" role="alert">{error}</p>}
        <a className="admin-back-link" href="/"><ArrowLeft size={15} />Back to storefront</a>
      </section>
    </main>
  )
}

function ProductCreator({ stages, onCancel, onSaved }) {
  const [sku, setSku] = useState('')
  const [slug, setSlug] = useState('')
  const [stageCode, setStageCode] = useState(stages[0]?.code || '')
  const [status, setStatus] = useState('draft')
  const [price, setPrice] = useState('')
  const [translations, setTranslations] = useState({
    en: { name: '', shortDescription: '', description: '', material: '', careInstructions: '' },
    ckb: { name: '', shortDescription: '', description: '', material: '', careInstructions: '' },
  })
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  function updateTranslation(locale, field, value) {
    setTranslations((current) => ({
      ...current,
      [locale]: { ...current[locale], [field]: value },
    }))
  }

  function suggestSlug(value) {
    return value.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+_+/g, '-')
      .trim('-')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving('product')
    try {
      const priceMinor = inputToAmount(price, 'IQD')
      if (priceMinor === undefined) {
        setError('Enter a valid non-negative price.')
        setSaving('')
        return
      }
      await api('/api/admin/products', {
        method: 'POST',
        body: {
          sku: sku.trim(),
          slug: slug.trim(),
          stageCode,
          status,
          priceMinor,
          translations: {
            en: { name: translations.en.name, shortDescription: translations.en.shortDescription, description: translations.en.description, material: translations.en.material, careInstructions: translations.en.careInstructions },
            ckb: { name: translations.ckb.name, shortDescription: translations.ckb.shortDescription, description: translations.ckb.description, material: translations.ckb.material, careInstructions: translations.ckb.careInstructions },
          },
        },
      })
      onSaved()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="admin-editor">
      <form className="admin-section" onSubmit={handleSubmit}>
        <div className="admin-section-heading">
          <div><p className="admin-eyebrow">NEW PRODUCT</p><h2>Create product</h2></div>
          <button type="submit" className="admin-primary-button" disabled={saving !== ''}><Save size={15} />Create product</button>
          <button type="button" className="admin-secondary-button" onClick={onCancel}>Cancel</button>
        </div>
        {error && <p className="admin-error admin-inline-error" role="alert">{error}</p>}
        <div className="admin-fields admin-fields-inline">
          <label>Product SKU
            <input type="text" placeholder="e.g. POSH-KG-007" value={sku} onChange={(event) => { setSku(event.target.value); if (!slug) setSlug(suggestSlug(event.target.value)) }} required />
          </label>
          <label>URL slug
            <input type="text" placeholder="e.g. winter-sweater" value={slug} onChange={(event) => setSlug(event.target.value)} required />
          </label>
          <label>Publication
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Draft</option><option value="active">Active</option></select>
          </label>
          <label>Base price (IQD)
            <input type="number" min="0" step="1" placeholder="Leave blank for price on request" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
          <label>School stage
            <select value={stageCode} onChange={(event) => setStageCode(event.target.value)}>
              {stages.map((stage) => <option key={stage.code} value={stage.code}>{stage.nameEn}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-translations">
          {['en', 'ckb'].map((locale) => (
            <fieldset key={locale} className="admin-translation">
              <legend>{locale === 'en' ? 'English' : 'Sorani Kurdish'}</legend>
              <label>Name<input value={translations[locale]?.name || ''} onChange={(event) => updateTranslation(locale, 'name', event.target.value)} required /></label>
              <label>Short description<textarea rows="2" value={translations[locale]?.shortDescription || ''} onChange={(event) => updateTranslation(locale, 'shortDescription', event.target.value)} /></label>
              <label>Full description<textarea rows="3" value={translations[locale]?.description || ''} onChange={(event) => updateTranslation(locale, 'description', event.target.value)} /></label>
              <label>Material<input value={translations[locale]?.material || ''} onChange={(event) => updateTranslation(locale, 'material', event.target.value)} /></label>
              <label>Care instructions<input value={translations[locale]?.careInstructions || ''} onChange={(event) => updateTranslation(locale, 'careInstructions', event.target.value)} /></label>
            </fieldset>
          ))}
        </div>
      </form>
    </div>
  )
}

function ProductEditor({ product, stages, colors, sizes, onSaved }) {
  const [draft, setDraft] = useState(() => ({
    stageCode: product.stageCode,
    status: product.status,
    price: amountToInput(product.priceMinor, product.currency),
    translations: {
      en: { ...product.translations.en },
      ckb: { ...product.translations.ckb },
    },
  }))
  const [imageUrls, setImageUrls] = useState(() => product.images.map((image) => image.url).join('\n'))
  const [variants, setVariants] = useState(() => product.variants.map((variant) => ({
    ...variant,
    priceInput: amountToInput(variant.priceMinor, variant.currency),
    stockInput: variant.stockOnHand === null ? '' : String(variant.stockOnHand),
  })))
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [addingVariant, setAddingVariant] = useState(false)
  const [newVariant, setNewVariant] = useState({ colorCode: '', sizeCode: '', variantSku: '', price: '', trackInventory: false, stockOnHand: '' })
  const [archiving, setArchiving] = useState(false)

  function updateTranslation(locale, field, value) {
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [field]: value },
      },
    }))
  }

  async function saveProduct(event) {
    event.preventDefault()
    const priceMinor = inputToAmount(draft.price, product.currency)
    if (priceMinor === undefined) {
      setMessage('Enter a valid non-negative price.')
      return
    }
    setSaving('product')
    setMessage('')
    try {
      await api(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        body: { ...draft, priceMinor },
      })
      setMessage('Product saved.')
      onSaved()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving('')
    }
  }

  async function saveImages() {
    const urls = imageUrls.split('\n').map((url) => url.trim()).filter(Boolean)
    setSaving('images')
    setMessage('')
    try {
      await api(`/api/admin/products/${product.id}/images`, {
        method: 'PUT',
        body: { images: urls.map((url) => ({ url, altText: product.translations.en.name })) },
      })
      setMessage('Photos saved.')
      onSaved()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving('')
    }
  }

  async function saveVariant(variant) {
    const priceMinor = inputToAmount(variant.priceInput, variant.currency)
    const stockOnHand = variant.trackInventory ? Number(variant.stockInput) : null
    if (priceMinor === undefined || (variant.trackInventory && (!Number.isSafeInteger(stockOnHand) || stockOnHand < 0))) {
      setMessage('Check the variant price and stock values.')
      return
    }
    setSaving(variant.id)
    setMessage('')
    try {
      await api(`/api/admin/variants/${variant.id}`, {
        method: 'PATCH',
        body: { priceMinor, trackInventory: variant.trackInventory, stockOnHand },
      })
      setVariants((current) => current.map((item) => item.id === variant.id
        ? { ...item, priceMinor, stockOnHand, priceInput: variant.priceInput, stockInput: stockOnHand }
        : item))
      setMessage(`${variant.colorNameEn} / ${variant.sizeLabel} saved.`)
      onSaved()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving('')
    }
  }

  async function archiveProduct() {
    if (!confirm('Archive this product? It will no longer appear on the storefront, but can be restored by editing it.')) return
    setArchiving(true)
    setMessage('')
    try {
      await api(`/api/admin/products/${product.id}`, { method: 'DELETE' })
      onSaved()
    } catch (error) {
      setMessage(error.message)
      setArchiving(false)
    }
  }

  async function addVariant(event) {
    event.preventDefault()
    const priceMinor = inputToAmount(newVariant.price, 'IQD')
    if (priceMinor === undefined) {
      setMessage('Enter a valid non-negative price.')
      return
    }
    setSaving('newVariant')
    setMessage('')
    try {
      const result = await api(`/api/admin/products/${product.id}/variants`, {
        method: 'POST',
        body: {
          colorCode: newVariant.colorCode,
          sizeCode: newVariant.sizeCode,
          variantSku: newVariant.variantSku,
          priceMinor,
          trackInventory: newVariant.trackInventory,
          stockOnHand: newVariant.trackInventory ? Number(newVariant.stockOnHand) : null,
        },
      })
      const created = result.variant
      setVariants((current) => [...current, {
        ...created,
        colorNameEn: colors.find((c) => c.code === created.colorCode)?.nameEn || '',
        colorNameCkb: colors.find((c) => c.code === created.colorCode)?.nameCkb || '',
        colorHex: colors.find((c) => c.code === created.colorCode)?.hexValue || '',
        sizeLabel: sizes.find((s) => s.code === created.sizeCode)?.label || '',
        priceInput: amountToInput(created.priceMinor, 'IQD'),
        stockInput: created.stockOnHand === null ? '' : String(created.stockOnHand),
      }])
      setAddingVariant(false)
      setNewVariant({ colorCode: '', sizeCode: '', variantSku: '', price: '', trackInventory: false, stockOnHand: '' })
      setMessage(`${created.colorCode} / ${created.sizeCode} variant added.`)
      onSaved()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving('')
    }
  }

  async function deactivateVariant(variantId) {
    if (!confirm('Deactivate this variant? It will no longer appear on the storefront.')) return
    try {
      await api(`/api/admin/variants/${variantId}`, { method: 'DELETE' })
      setVariants((current) => current.filter((v) => v.id !== variantId))
      setMessage('Variant deactivated.')
      onSaved()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <div className="admin-editor">
      <form className="admin-section" onSubmit={saveProduct}>
        <div className="admin-section-heading"><div><p className="admin-eyebrow">PRODUCT</p><h2>{product.sku}</h2></div><button className="admin-primary-button" type="submit" disabled={saving !== ''}><Save size={15} />Save product</button><button type="button" className="admin-danger-button" disabled={archiving} onClick={archiveProduct}><Archive size={15} />Archive product</button></div>
        <div className="admin-fields admin-fields-inline">
          <label>School stage<select value={draft.stageCode} onChange={(event) => setDraft({ ...draft, stageCode: event.target.value })}>{stages.map((stage) => <option key={stage.code} value={stage.code}>{stage.nameEn}</option>)}</select></label>
          <label>Publication<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
          <label>Base price (IQD)<input type="number" min="0" step="1" value={draft.price} placeholder="Leave blank for price on request" onChange={(event) => setDraft({ ...draft, price: event.target.value })} /><small>Variant prices override this value.</small></label>
        </div>
        <div className="admin-translations">
          {['en', 'ckb'].map((locale) => (
            <fieldset key={locale} className="admin-translation">
              <legend>{locale === 'en' ? 'English' : 'Sorani Kurdish'}</legend>
              <label>Name<input value={draft.translations[locale]?.name || ''} onChange={(event) => updateTranslation(locale, 'name', event.target.value)} required /></label>
              <label>Short description<textarea rows="2" value={draft.translations[locale]?.shortDescription || ''} onChange={(event) => updateTranslation(locale, 'shortDescription', event.target.value)} /></label>
              <label>Full description<textarea rows="3" value={draft.translations[locale]?.description || ''} onChange={(event) => updateTranslation(locale, 'description', event.target.value)} /></label>
              <label>Material<input value={draft.translations[locale]?.material || ''} onChange={(event) => updateTranslation(locale, 'material', event.target.value)} /></label>
              <label>Care instructions<input value={draft.translations[locale]?.careInstructions || ''} onChange={(event) => updateTranslation(locale, 'careInstructions', event.target.value)} /></label>
            </fieldset>
          ))}
        </div>
      </form>

      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-eyebrow">PHOTOS</p><h2>Product images</h2></div><button className="admin-secondary-button" type="button" onClick={saveImages} disabled={saving !== ''}><ImagePlus size={15} />Save photos</button></div>
        <label className="admin-photo-input">HTTPS image URLs, one per line<textarea rows="4" value={imageUrls} onChange={(event) => setImageUrls(event.target.value)} placeholder="https://..." /></label>
        <p className="admin-help">First image is used on product cards; the rest appear in the gallery order.</p>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-eyebrow">VARIANTS</p><h2>Pricing & inventory</h2></div><button className="admin-secondary-button" type="button" onClick={() => setAddingVariant(!addingVariant)}><Plus size={15} />{addingVariant ? 'Cancel' : 'Add variant'}</button></div>
        {addingVariant && (
          <form className="admin-variant-form" onSubmit={addVariant}>
            <label>Color
              <select value={newVariant.colorCode} onChange={(event) => setNewVariant({ ...newVariant, colorCode: event.target.value })} required>
                <option value="">Select a color</option>
                {colors.map((color) => <option key={color.code} value={color.code}>{color.nameEn}</option>)}
              </select>
            </label>
            <label>Size
              <select value={newVariant.sizeCode} onChange={(event) => setNewVariant({ ...newVariant, sizeCode: event.target.value })} required>
                <option value="">Select a size</option>
                {sizes.map((size) => <option key={size.code} value={size.code}>{size.label}</option>)}
              </select>
            </label>
            <label>Variant SKU
              <input type="text" placeholder="e.g. POSH-KG-001-NAVY-S" value={newVariant.variantSku} onChange={(event) => setNewVariant({ ...newVariant, variantSku: event.target.value })} required />
            </label>
            <label>Price (IQD)
              <input type="number" min="0" step="1" placeholder="Leave blank for base price" value={newVariant.price} onChange={(event) => setNewVariant({ ...newVariant, price: event.target.value })} />
            </label>
            <div className="variant-sku-field">
              <label><input type="checkbox" checked={newVariant.trackInventory} onChange={(event) => setNewVariant({ ...newVariant, trackInventory: event.target.checked })} /> Track stock for this variant</label>
              {newVariant.trackInventory && (
                <label>Stock on hand
                  <input type="number" min="0" step="1" value={newVariant.stockOnHand} onChange={(event) => setNewVariant({ ...newVariant, stockOnHand: event.target.value })} required />
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1' }}>
              <button type="submit" className="admin-primary-button" disabled={saving !== ''}><Plus size={15} />Add variant</button>
              <button type="button" className="admin-secondary-button" onClick={() => setAddingVariant(false)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="variant-table-wrap">
          <table className="variant-table">
            <thead><tr><th>Color</th><th>Size</th><th>Price override (IQD)</th><th>Track stock</th><th>On hand</th><th>Actions</th></tr></thead>
            <tbody>{variants.map((variant) => (
              <tr key={variant.id}>
                <td><span className="variant-color"><i style={{ background: variant.colorHex }} />{variant.colorNameEn}</span></td>
                <td>{variant.sizeLabel}</td>
                <td><input aria-label={`${variant.colorNameEn} ${variant.sizeLabel} price in IQD`} type="number" min="0" step="1" value={variant.priceInput} placeholder="Use base" onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, priceInput: event.target.value } : item))} /></td>
                <td><input aria-label={`Track stock for ${variant.colorNameEn} ${variant.sizeLabel}`} type="checkbox" checked={variant.trackInventory} onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, trackInventory: event.target.checked, stockInput: event.target.checked ? item.stockInput ?? '0' : '' } : item))} /></td>
                <td><input aria-label={`${variant.colorNameEn} ${variant.sizeLabel} stock`} type="number" min="0" step="1" disabled={!variant.trackInventory} value={variant.trackInventory ? variant.stockInput ?? '' : ''} onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, stockInput: event.target.value } : item))} /></td>
                <td><button type="button" className="table-save" disabled={saving !== ''} onClick={() => saveVariant(variant)}>{saving === variant.id ? 'Saving...' : 'Save'}</button><button type="button" className="admin-danger-button" onClick={() => deactivateVariant(variant.id)}>Deactivate</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      {message && <p className="admin-feedback" role="status">{message}</p>}
    </div>
  )
}

function AnalyticsPanel({ analytics }) {
  const daily = new Map()
  for (const row of analytics.dailyPageViews) {
    daily.set(row.day, { pageViews: Number(row.count), orders: 0 })
  }
  for (const row of analytics.dailyOrderRequests) {
    const current = daily.get(row.day) || { pageViews: 0, orders: 0 }
    current.orders = Number(row.count)
    daily.set(row.day, current)
  }

  return (
    <section className="admin-analytics">
      <p className="admin-help">Anonymous page views and order requests from the last 30 days. No visitor identifiers are stored.</p>
      <div className="admin-analytics-stats">
        <article><span>Page views</span><strong>{analytics.pageViews}</strong></article>
        <article><span>Order requests</span><strong>{analytics.orderRequests}</strong></article>
        <article><span>Requests per page view</span><strong>{analytics.orderRequestsPerPageView}%</strong></article>
      </div>
      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-eyebrow">LAST 30 DAYS</p><h2>Daily activity</h2></div><BarChart3 size={18} /></div>
        {daily.size === 0 ? <p className="admin-help">Activity will appear here as customers visit and place orders.</p> : (
          <div className="variant-table-wrap">
            <table className="variant-table">
              <thead><tr><th>Date</th><th>Page views</th><th>Order requests</th></tr></thead>
              <tbody>{Array.from(daily.entries()).sort(([first], [second]) => second.localeCompare(first)).map(([day, counts]) => (
                <tr key={day}><td>{day}</td><td>{counts.pageViews}</td><td>{counts.orders}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-eyebrow">MOST VISITED</p><h2>Top pages</h2></div></div>
        {analytics.topPages.length === 0 ? <p className="admin-help">No page views recorded yet.</p> : (
          <div className="variant-table-wrap">
            <table className="variant-table">
              <thead><tr><th>Page</th><th>Views</th></tr></thead>
              <tbody>{analytics.topPages.map((page) => <tr key={page.path}><td>{page.path}</td><td>{page.count}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

function localDateInputValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function AccountingPanel({ accounting, onReload }) {
  const [startDate, setStartDate] = useState(accounting.from)
  const [endDate, setEndDate] = useState(accounting.to)
  const [entryType, setEntryType] = useState('expense')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [transferTo, setTransferTo] = useState('bank_transfer')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => localDateInputValue())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  function downloadCsv() {
    window.location.assign(`/api/admin/accounting?from=${encodeURIComponent(accounting.from)}&to=${encodeURIComponent(accounting.to)}&format=csv`)
  }

  async function correctEntry(entry) {
    const explanation = window.prompt(`Explain why you are reversing this ${entry.entry_type} entry:`)
    if (explanation === null) return
    if (explanation.trim().length < 3) {
      setError('Enter a correction explanation with at least 3 characters.')
      return
    }
    setError('')
    setFeedback('')
    try {
      await api(`/api/admin/accounting/entries/${entry.id}/correct`, {
        method: 'POST',
        body: { description: explanation },
      })
      setFeedback('Reversal recorded. The original entry remains in the audit history.')
      onReload()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function saveEntry(event) {
    event.preventDefault()
    const amountMinor = inputToAmount(amount, 'IQD')
    if (amountMinor === undefined || amountMinor === null || amountMinor < 1) {
      setError('Enter an amount greater than zero.')
      return
    }
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      await api('/api/admin/accounting/entries', {
        method: 'POST',
        body: {
          entryType,
          paymentMethod,
          ...(entryType === 'transfer' ? { transferTo } : {}),
          category,
          description,
          amountMinor,
          occurredAt,
        },
      })
      setCategory('')
      setDescription('')
      setAmount('')
      setFeedback('Entry recorded.')
      onReload()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function applyDateRange(event) {
    event.preventDefault()
    setError('')
    if (!startDate || !endDate || startDate > endDate) {
      setError('Choose a valid date range.')
      return
    }
    const rangeLength = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000
    if (rangeLength > 365) {
      setError('Date range cannot exceed 366 calendar days.')
      return
    }
    onReload(startDate, endDate)
  }

  function money(amountMinor, sign = '') {
    return `${sign}${new Intl.NumberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amountMinor)}`
  }

  const typeLabels = {
    sale: 'Order sale',
    manual_sale: 'Walk-in sale',
    expense: 'Expense',
    other_income: 'Other income',
    refund: 'Refund',
    opening_balance: 'Opening balance',
    transfer: 'Account transfer',
    correction: 'Correction',
  }

  return (
    <section className="admin-accounting">
      <p className="admin-help">Operational store books in IQD, not a tax filing or double-entry accounting system. Opening balances establish each account's starting cash. Transfers move money between accounts without affecting profit. Corrections reverse an eligible entry without removing its audit history.</p>
      <div className="admin-accounting-balances">
        <article><span>Cash balance</span><strong>{money(accounting.balances.cash)}</strong></article>
        <article><span>Bank balance</span><strong>{money(accounting.balances.bank_transfer)}</strong></article>
      </div>

      <form className="admin-section admin-accounting-range" onSubmit={applyDateRange}>
        <div className="admin-section-heading"><div><p className="admin-eyebrow">FINANCIAL REPORT</p><h2>Choose a reporting period</h2></div></div>
        <div className="admin-fields admin-fields-inline">
          <label>From<input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
          <label>To<input type="date" value={endDate} min={startDate} max={localDateInputValue()} onChange={(event) => setEndDate(event.target.value)} required /></label>
          <button className="admin-secondary-button" type="submit">Apply dates</button>
        </div>
      </form>

      <div className="admin-accounting-summary">
        <article><span>Income, net of refunds</span><strong>{money(accounting.incomeMinor)}</strong></article>
        <article><span>Expenses</span><strong>{money(accounting.expensesMinor)}</strong></article>
        <article><span>Net operating profit</span><strong>{money(accounting.netProfitMinor)}</strong></article>
      </div>

      <form className="admin-section" onSubmit={saveEntry}>
        <div className="admin-section-heading"><div><p className="admin-eyebrow">MANUAL ENTRY</p><h2>Record a transaction</h2></div></div>
        <div className="admin-fields admin-accounting-form">
          <label>Entry type<select value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="expense">Expense</option><option value="other_income">Other income</option><option value="manual_sale">Walk-in sale (ledger only)</option><option value="opening_balance">Opening balance</option><option value="transfer">Transfer between accounts</option></select></label>
          <label>Payment account<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></select></label>
          {entryType === 'transfer' && <label>Transfer to<select value={transferTo} onChange={(event) => setTransferTo(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></select></label>}
          <label>Category<input maxLength="80" value={category} onChange={(event) => setCategory(event.target.value)} placeholder={entryType === 'expense' ? 'Rent, utilities, supplies...' : entryType === 'opening_balance' ? 'Starting cash or bank balance' : entryType === 'manual_sale' ? 'In-store sale' : entryType === 'transfer' ? 'Cash deposit, cash withdrawal...' : 'Other income'} required /></label>
          <label>Description<input maxLength="500" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this transaction for?" required /></label>
          <label>Amount (IQD)<input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>Date<input type="date" max={localDateInputValue()} value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></label>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {feedback && <p className="admin-feedback" role="status">{feedback}</p>}
        <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Record transaction'}</button>
      </form>

      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-eyebrow">TRANSACTION HISTORY</p><h2>{accounting.from} to {accounting.to}</h2></div><button className="admin-secondary-button" type="button" onClick={downloadCsv}>Export CSV</button></div>
        {accounting.entries.length === 0 ? <p className="admin-help">No financial entries in this period.</p> : (
          <div className="variant-table-wrap">
            <table className="variant-table">
            <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Account</th><th>Amount</th><th /></tr></thead>
              <tbody>{accounting.entries.map((entry) => {
              const negative = entry.entry_type === 'transfer'
                ? true
                : entry.entry_type === 'correction'
                  ? entry.direction === 'outflow'
                  : entry.direction === 'outflow'
              return (
                <tr key={entry.id}>
                    <td>{localDateInputValue(new Date(entry.occurred_at))}</td>
                    <td>{typeLabels[entry.entry_type] || entry.entry_type}</td>
                    <td>{entry.category}</td>
                    <td>{entry.description}</td>
                    <td>{entry.entry_type === 'transfer'
                      ? `${entry.payment_method === 'cash' ? 'Cash' : 'Bank'} → ${entry.transfer_to === 'cash' ? 'Cash' : 'Bank'}`
                      : entry.payment_method === 'cash' ? 'Cash' : 'Bank transfer'}</td>
                    <td>{money(entry.amountMinor, negative ? '−' : '+')}</td>
                    <td>{!entry.order_id && !entry.payment_id && !entry.reversal_of_entry_id && <button className="table-save" type="button" onClick={() => correctEntry(entry)}>Reverse</button>}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

function OrderPaymentControls({ order, onPaid }) {
  const [amount, setAmount] = useState(amountToInput(order.remainingMinor ?? order.totalMinor, order.currency.trim()))
  const [finalTotal, setFinalTotal] = useState(amountToInput(order.totalMinor, order.currency.trim()))
  const [refundAmount, setRefundAmount] = useState(amountToInput(order.refundableMinor, order.currency.trim()))
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [refundMethod, setRefundMethod] = useState(order.payment_method || 'cash')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function recordRefund() {
    const amountMinor = inputToAmount(refundAmount, order.currency.trim())
    if (amountMinor === undefined || amountMinor === null || amountMinor < 1) {
      setError('Enter a valid refund amount.')
      return
    }
    if (!window.confirm(`Record a refund of ${refundAmount} ${order.currency.trim()} for ${order.order_number}?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        body: { amountMinor, paymentMethod: refundMethod },
      })
      setMessage('Refund recorded in accounting.')
      onPaid()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function markPaid(event) {
    event.preventDefault()
    const amountMinor = inputToAmount(amount, order.currency.trim())
    const finalTotalMinor = inputToAmount(finalTotal, order.currency.trim())
    if (amountMinor === undefined || amountMinor === null || amountMinor < 1) {
      setError('Enter a valid amount received.')
      return
    }
    if (finalTotalMinor === undefined || finalTotalMinor === null || finalTotalMinor < 1) {
      setError('Enter a valid final order total.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api(`/api/admin/orders/${order.id}/payment`, {
        method: 'POST',
        body: { amountMinor, finalTotalMinor, paymentMethod },
      })
      setAmount(amountToInput(order.remainingMinor === null ? null : Math.max(0, order.remainingMinor - amountMinor), order.currency.trim()))
      setMessage('Payment recorded in accounting.')
      onPaid()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  if (order.payment_status === 'refunded') {
    return <p className="admin-payment-recorded" role="status">Refunded · full payment returned</p>
  }

  return (
    <div className="admin-payment-form">
      <p className="admin-help">Received: {amountToInput(order.paidMinor, order.currency.trim())} {order.currency.trim()}{order.totalMinor === null ? '' : ` of ${amountToInput(order.totalMinor, order.currency.trim())} ${order.currency.trim()}`}</p>
      {order.status !== 'cancelled'
        && order.payment_status !== 'paid'
        && (
          <form className="admin-payment-fields" onSubmit={markPaid}>
            <label>Final order total (IQD)<input type="number" min="1" step="1" value={finalTotal} onChange={(event) => setFinalTotal(event.target.value)} required /></label>
            <label>Received now (IQD)<input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
            <label>Received by<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></select></label>
            <button className="table-save" type="submit" disabled={busy || order.subtotalMinor === null}>{busy ? 'Saving...' : 'Record payment'}</button>
            {order.subtotalMinor === null && <span className="admin-help">Set all product prices first.</span>}
          </form>
        )}
      {order.refundableMinor > 0 && (
        <form className="admin-payment-fields" onSubmit={(event) => { event.preventDefault(); void recordRefund() }}>
          <label>Refund amount (IQD)<input type="number" min="1" max={order.refundableMinor} step="1" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} required /></label>
          <label>Refund from<select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></select></label>
          <button className="table-save" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Record refund'}</button>
        </form>
      )}
      {order.status === 'cancelled' && order.refundableMinor === 0 && <p className="admin-help">Cancelled order · no outstanding payment to refund.</p>}
      {error && <span className="admin-error" role="alert">{error}</span>}
      {message && <span className="admin-feedback" role="status">{message}</span>}
    </div>
  )
}

function AdminApp() {
  const [admin, setAdmin] = useState(null)
  const [setup, setSetup] = useState({ setupRequired: false, setupEnabled: false })
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [dataStatus, setDataStatus] = useState('idle')
  const [dataError, setDataError] = useState('')
   const [products, setProducts] = useState([])
  const [stages, setStages] = useState([])
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [orders, setOrders] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [accounting, setAccounting] = useState(null)
  const [accountingRange, setAccountingRange] = useState(() => ({
    from: localDateInputValue(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
    to: localDateInputValue(),
  }))
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedTab, setSelectedTab] = useState('products')
  const [selectedOrderStatuses, setSelectedOrderStatuses] = useState({})
  const [reloadToken, setReloadToken] = useState(0)
  const [creatingProduct, setCreatingProduct] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/api/admin/setup-status'), api('/api/admin/session')])
      .then(([setupResult, sessionResult]) => {
        if (cancelled) return
        setSetup(setupResult)
        setAdmin(sessionResult.admin)
        setAuthLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        setAuthError(error.message)
        setAuthLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!admin) return undefined
    const controller = new AbortController()
    Promise.all([
      api('/api/admin/products', { signal: controller.signal }),
      api('/api/admin/orders', { signal: controller.signal }),
      api('/api/admin/analytics', { signal: controller.signal }),
      api(`/api/admin/accounting?from=${accountingRange.from}&to=${accountingRange.to}`, { signal: controller.signal }),
    ])
      .then(([productData, orderData, analyticsData, accountingData]) => {
        setProducts(productData.products)
        setStages(productData.stages)
        setColors(productData.colors || [])
        setSizes(productData.sizes || [])
        setOrders(orderData.orders)
        setAnalytics(analyticsData)
        setAccounting(accountingData)
        setSelectedProductId((current) => current || productData.products[0]?.id || '')
        setDataStatus('ready')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setDataError(error.message)
        setDataStatus('error')
      })
    return () => controller.abort()
  }, [admin, reloadToken, accountingRange])

  async function handleLogin(credentials) {
    setAuthError('')
    const result = await api('/api/admin/login', { method: 'POST', body: credentials })
    setAdmin(result.admin)
  }

  async function handleSetup(credentials) {
    setAuthError('')
    const result = await api('/api/admin/setup', { method: 'POST', body: credentials })
    setAdmin(result.admin)
    setSetup({ setupRequired: false, setupEnabled: false })
  }

  async function handleCreateProduct(credentials) {
    setDataError('')
    try {
      await api('/api/admin/products', { method: 'POST', body: credentials })
      setCreatingProduct(false)
      setSelectedProductId(products[0]?.id || '')
      refreshData()
    } catch (error) {
      setDataError(error.message)
    }
  }

  async function handleLogout() {
    await api('/api/admin/logout', { method: 'POST', body: {} })
    setAdmin(null)
    setProducts([])
    setOrders([])
    setAnalytics(null)
    setAccounting(null)
    setDataStatus('idle')
  }

  async function updateOrderStatus(orderId) {
    try {
      await api(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status: selectedOrderStatuses[orderId] },
      })
      setDataError('')
      setDataStatus('loading')
      setReloadToken((current) => current + 1)
    } catch (error) {
      setDataError(error.message)
    }
  }

  function refreshData() {
    setDataStatus('loading')
    setReloadToken((current) => current + 1)
  }

  function refreshAccounting(from = accountingRange.from, to = accountingRange.to) {
    setAccountingRange({ from, to })
    setDataStatus('loading')
    setReloadToken((current) => current + 1)
  }

  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  }, [])

  if (authLoading) {
    return <main className="admin-loading">Checking protected admin access...</main>
  }
  if (!admin) {
    return <AuthScreen setup={setup} onLogin={handleLogin} onSetup={handleSetup} initialError={authError} />
  }

  const selectedProduct = products.find((product) => product.id === selectedProductId)

  return (
    <div className="admin-app">
      <header className="admin-header">
        <a className="admin-brand" href="/"><span>POSHRAW<span>.</span>Co</span><small>STORE ADMIN</small></a>
        <div className="admin-user"><span>{admin.email}</span><button className="admin-secondary-button" type="button" onClick={handleLogout}><LogOut size={15} />Sign out</button></div>
      </header>
      <main className="admin-main">
        <div className="admin-page-heading"><div><p className="admin-eyebrow">CONTROL PANEL</p><h1>Store management</h1></div><button className="admin-secondary-button" type="button" onClick={refreshData}><RefreshCw size={15} />Refresh</button></div>
        <div className="admin-stats"><div><Box size={17} /><strong>{products.length}</strong><span>Products</span></div><div><PackageCheck size={17} /><strong>{orders.length}</strong><span>Orders</span></div><div><ShieldCheck size={17} /><strong>{products.reduce((total, product) => total + product.variants.filter((variant) => variant.trackInventory).length, 0)}</strong><span>Tracked variants</span></div></div>
        <div className="admin-tabs" role="tablist" aria-label="Admin sections"><button type="button" role="tab" aria-selected={selectedTab === 'products'} className={selectedTab === 'products' ? 'active' : ''} onClick={() => setSelectedTab('products')}>Products</button><button type="button" role="tab" aria-selected={selectedTab === 'orders'} className={selectedTab === 'orders' ? 'active' : ''} onClick={() => setSelectedTab('orders')}>Orders</button><button type="button" role="tab" aria-selected={selectedTab === 'analytics'} className={selectedTab === 'analytics' ? 'active' : ''} onClick={() => setSelectedTab('analytics')}>Analytics</button><button type="button" role="tab" aria-selected={selectedTab === 'accounting'} className={selectedTab === 'accounting' ? 'active' : ''} onClick={() => setSelectedTab('accounting')}>Accounting</button></div>
        {dataError && <p className="admin-error admin-inline-error" role="alert">{dataError}</p>}
        {dataStatus === 'loading' || dataStatus === 'idle' ? <p className="admin-loading">Loading store data...</p> : dataStatus === 'error' ? <p className="admin-error">{dataError}</p> : selectedTab === 'accounting' ? (
          accounting && <AccountingPanel accounting={accounting} onReload={refreshAccounting} />
        ) : selectedTab === 'analytics' ? (
          analytics && <AnalyticsPanel analytics={analytics} />
        ) : selectedTab === 'products' ? (
          <div className="admin-workspace">
            <aside className="admin-product-list" aria-label="Product list">
              <div style={{ padding: '8px 15px', borderBottom: '1px solid #edf0f4' }}><button className="admin-primary-button" type="button" style={{ width: '100%', fontSize: '10.5px' }} onClick={() => setCreatingProduct(true)}><Plus size={14} />New product</button></div>
              {products.map((product) => <button key={product.id} type="button" className={selectedProductId === product.id ? 'active' : ''} onClick={() => setSelectedProductId(product.id)}><span>{product.translations.en?.name || product.sku}</span><small>{product.sku} · {product.status}</small></button>)}
            </aside>
            {creatingProduct ? (
              <ProductCreator stages={stages} onCancel={() => setCreatingProduct(false)} onSaved={() => { setCreatingProduct(false); refreshData() }} />
            ) : selectedProduct ? (
              <ProductEditor key={selectedProduct.id} product={selectedProduct} stages={stages} colors={colors} sizes={sizes} onSaved={refreshData} />
            ) : (
              <div className="admin-section"><p>Select a product to edit, or create a new one.</p></div>
            )}
          </div>
        ) : (
          <section className="admin-orders">
            {orders.length === 0 ? <div className="admin-empty"><PackageCheck size={22} /><h2>No orders yet</h2><p>New storefront order requests will appear here.</p></div> : (
              <div className="admin-order-list">{orders.map((order) => (
                <article className="admin-order-row" key={order.id}>
                  <div><strong>{order.order_number}</strong><span>{order.customer_name_snapshot || 'Customer details not provided'}</span><small>{order.customer_phone_snapshot}</small><small>{order.fulfillment_method === 'delivery' ? `Delivery · ${order.delivery_address_snapshot?.address || 'Address not provided'}` : 'Pickup at store'}</small><small>{order.totalMinor === null ? 'Quote pending' : new Intl.NumberFormat('en-IQ', { style: 'currency', currency: order.currency.trim() }).format(Number(order.totalMinor) / currencyScale(order.currency.trim()))}</small><small>Payment: {order.payment_status}</small><small>{new Date(order.placed_at).toLocaleString()}</small></div>
                  <div className="admin-order-items">{order.items.map((item, index) => <span key={`${order.id}-${index}`}>{item.product_name_snapshot} · {item.color_name_snapshot} · {item.size_label_snapshot} × {item.quantity}</span>)}</div>
                  <OrderPaymentControls key={`${order.id}-${order.payment_status}-${order.totalMinor}-${order.paidMinor}-${order.refundableMinor}`} order={order} onPaid={refreshData} />
                  <div className="admin-order-status"><select aria-label={`Status for ${order.order_number}`} value={selectedOrderStatuses[order.id] || order.status} onChange={(event) => setSelectedOrderStatuses({ ...selectedOrderStatuses, [order.id]: event.target.value })}>{orderStatusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button className="table-save" type="button" onClick={() => updateOrderStatus(order.id)}>Save status</button></div>
                </article>
              ))}</div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default AdminApp