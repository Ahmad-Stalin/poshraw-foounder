import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, Check, Clock3, MapPin, Menu, MessageCircle, Phone, RefreshCw, ShieldCheck, ShoppingBag, Truck, X } from 'lucide-react'
import './App.css'

const copy = {
  ku: {
    direction: 'rtl',
    location: 'سلێمانی، خوار فلکەی خاڵە حاجی',
    contactLine: 'پەیوەندی: واتساپ',
    openingHours: 'کاتی کار',
    openingHoursUnknown: 'کاتی کار پشتڕاست نەکراوەتەوە. پێش سەردان، لە واتساپ پەیوەندیمان پێوە بکەن.',
    policies: 'گەیاندن و زانیارییەکان',
    policyEyebrow: 'زانیاریی داواکردن',
    policyTitle: 'پێش داواکردن، وردەکارییەکان بپرسە.',
    policyIntro: 'پێش تەواوکردنی داواکاری، ئەم زانیارییانە لەگەڵ فرۆشگا پشتڕاست بکەنەوە.',
    deliveryTitle: 'گەیاندن',
    deliveryText: 'بۆ پشتڕاستکردنەوەی ناوچەی گەیاندن، کرێ و کاتی گەیشتن، لە واتساپ پەیوەندیمان پێوە بکەن.',
    returnsTitle: 'گەڕاندنەوە و گۆڕین',
    returnsText: 'مەرجی گەڕاندنەوە و گۆڕین لەلایەن فرۆشگا پشتڕاست نەکراوەتەوە. پێش کڕین، لە واتساپ پرسیاری بکەن.',
    privacyTitle: 'پاراستنی نهێنی',
    privacyText: 'بۆ جێبەجێکردنی داواکاری، ناو، ژمارەی تەلەفۆن، ئیمەیڵ (ئەگەر بنووسرێت)، ناونیشان (ئەگەر گەیاندن هەڵبژێردرێت) و وردەکاریی بەرهەمەکان تۆمار دەکرێن. ئیمەیڵ تەنها بۆ نوێکاریی داواکاری بەکاردێت. تەنها بەڕێوەبەرانی ڕێگەپێدراو دەستپێگەیشتنیان پێیان هەیە. ژمارەی سەردانی لاپەڕەکان بەبێ ناسنامەی کەسی تۆمار دەکرێت.',
    mapLabel: 'تەنیشت مۆبیلیاتی هەواڵ هۆم، سلێمانی',
    collection: 'کۆمەڵەی ساڵی ٢٠٢٦ – ٢٠٢٧',
    headline: <>ڕۆژێکی نوێ،<br />بە جلوبەرگێکی <em>باشتر.</em></>,
    intro: 'جلوبەرگی قوتابخانەیی بە کوالێتیی بەرز، بۆ هەموو قۆناغەکانی خوێندن.',
    browse: 'بینینی جلوبەرگەکان',
    whatsapp: 'داواکردن لە واتساپ',
    crafted: 'بە وردی بۆ هەر ڕۆژێکی قوتابخانە دروستکراوە',
    shop: 'بەرهەمەکانمان',
    shopTitle: 'جلوبەرگی گونجاو،',
    shopEmphasis: 'بۆ هەموو قۆناغێک.',
    all: 'هەموو بەرهەمەکان',
    stages: ['باخچە', 'سەرەتایی', 'ناوەندی', 'ئامادەیی'],
    pieces: 'بەرهەم',
    quickView: 'وردەکاریی بەرهەم',
    order: 'داواکردن',
    priceInquiry: 'نرخ لە واتساپ',
    loadingCatalog: 'بەرهەمەکان بار دەکرێن...',
    catalogFailed: 'بارکردنی بەرهەمەکان سەرکەوتوو نەبوو.',
    retry: 'دووبارە هەوڵبدەرەوە',
    stock: 'بارودۆخی کۆگا',
    inStock: 'دانە لە کۆگا',
    stockUntracked: 'کۆگا تۆمار نەکراوە',
    outOfStock: 'لە کۆگا نەماوە',
    details: 'وردەکاریی بەرهەم',
    schoolStage: 'قۆناغی خوێندن',
    available: 'قەبارەکان',
    choose: 'قەبارە هەڵبژێرە',
    color: 'ڕەنگ',
    size: 'قەبارە',
    close: 'داخستن',
    madeFor: 'بۆ ساڵێکی خوێندنی باشتر',
    locationTitle: ' لە نزیترین شوێن  .',
    address: 'خوار فلکەی خاڵە حاجی، تەنیشت مۆبیلیاتی هەواڵ هۆم، سلێمانی',
    directions: 'ڕێنمایی بۆ گەیشتن',
    visit: 'سەردانمان بکەن',
    contact: 'پەیوەندیمان پێوە بکەن',
    follow: 'شوێنمان بکەوە',
    adminLink: 'بەڕێوەبردنی فرۆشگا',
    footerLine: 'جلوبەرگی ئاسوودە بۆ هەر ڕۆژێکی قوتابخانە.',
    selected: 'هەڵبژێردراو',
    chooseColor: 'ڕەنگێک هەڵبژێرە',
    cart: 'سەبەتە',
    orderFormTitle: 'داواکارییەکەت تەواو بکە',
    orderFormIntro: 'وردەکارییەکان بنووسە؛ فرۆشگا پێش پشتڕاستکردنەوەی داواکاری پەیوەندیت پێوە دەکات.',
    customerName: 'ناوی تەواو',
    phone: 'ژمارەی تەلەفۆن',
    email: 'ئیمەیڵ بۆ نوێکاریی داواکاری (ئارەزوومەندانە)',
    fulfillment: 'شێوازی وەرگرتن',
    pickup: 'وەرگرتن لە فرۆشگا',
    delivery: 'گەیاندن',
    deliveryAddress: 'ناونیشانی گەیاندن',
    deliveryFeeUnknown: 'کرێی گەیاندن لەگەڵ فرۆشگا پشتڕاست دەکرێتەوە.',
    subtotal: 'کۆی بەرهەمەکان',
    total: 'کۆی گشتی',
    quotePending: 'نرخ و کرێی گەیاندن پێش پشتڕاستکردنەوە لەلایەن فرۆشگا دیاری دەکرێن.',
    orderNotes: 'تێبینی بۆ داواکاری',
    quantity: 'ژمارە',
    remove: 'لابردن',
    submitOrder: 'تۆمارکردنی داواکاری',
    submitting: 'داواکاری دەنێردرێت...',
    orderSubmitted: 'داواکارییەکەت تۆمار کرا.',
    orderNumber: 'ژمارەی داواکاری',
    privacyConsent: 'ڕازیم کە زانیارییەکانم بۆ جێبەجێکردنی ئەم داواکارییە تۆمار بکرێن.',
    emptyCart: 'سەبەتەکە بەتاڵە.',
    orderFailed: 'تۆمارکردنی داواکاری سەرکەوتوو نەبوو.',
  },
  en: {
    direction: 'ltr',
    location: 'Sulaymaniyah, Khala Haji circle',
    contactLine: 'Contact us on WhatsApp',
    openingHours: 'Opening hours',
    openingHoursUnknown: 'Hours have not been confirmed. Message us on WhatsApp before visiting.',
    policies: 'Delivery & policies',
    policyEyebrow: 'ORDER INFORMATION',
    policyTitle: 'A few details before you order.',
    policyIntro: 'Please confirm these details with the store before completing an order.',
    deliveryTitle: 'Delivery',
    deliveryText: 'Ask us to confirm your delivery area, fee, and estimated arrival time before ordering.',
    returnsTitle: 'Returns & exchanges',
    returnsText: 'Return and exchange terms have not been confirmed by the store. Please ask on WhatsApp before purchase.',
    privacyTitle: 'Privacy',
    privacyText: 'To process an order, this site stores your name, phone number, optional email address, delivery address (if provided), and order details. If provided, your email is used only for order confirmations and status updates. Authorized store admins can access order records. Anonymous page-view counts are collected without personal identifiers.',
    mapLabel: 'Beside Hawal Home Furniture, Sulaymaniyah',
    collection: 'THE 2026 – 2027 COLLECTION',
    headline: <>A new day,<br />a <em>better fit.</em></>,
    intro: 'Thoughtfully made school uniforms, designed to keep up with every stage of growing.',
    browse: 'Explore uniforms',
    whatsapp: 'Order on WhatsApp',
    crafted: 'Considered details for every school day',
    whyChooseUs: 'Why POSHRAW',
    whyChooseUsTitle: 'Made for active routines and real school life.',
    whyChooseUsText: 'From early learners to senior students, our uniforms balance comfort, structure, and confidence in one thoughtful everyday piece.',
    shop: 'THE COLLECTION',
    shopTitle: 'A thoughtful fit,',
    shopEmphasis: 'at every stage.',
    all: 'View all',
    stages: ['Kindergarten', 'Primary', 'Middle school', 'High school'],
    pieces: 'pieces',
    quickView: 'Quick view',
    order: 'Order',
    priceInquiry: 'Price on request',
    loadingCatalog: 'Loading products...',
    catalogFailed: 'The catalog could not be loaded.',
    retry: 'Try again',
    stock: 'Stock status',
    inStock: 'in stock',
    stockUntracked: 'Stock not tracked',
    outOfStock: 'Out of stock',
    details: 'Product details',
    schoolStage: 'School stage',
    available: 'AVAILABLE SIZES',
    choose: 'Choose a size',
    color: 'Color',
    size: 'Size',
    close: 'Close',
    madeFor: 'MADE FOR THE YEAR AHEAD',
    locationTitle: 'Find us nearby.',
    address: 'Below Khala Haji circle, beside Hawal Home Furniture, Sulaymaniyah',
    directions: 'Get directions',
    visit: 'Come say hello',
    contact: 'Get in touch',
    follow: 'Follow along',
    adminLink: 'Store admin',
    footerLine: 'A uniform that feels right, every day.',
    selected: 'Selected',
    chooseColor: 'Choose a color',
    cart: 'Order bag',
    orderFormTitle: 'Complete your order',
    orderFormIntro: 'Share your details. The store will contact you to confirm the order.',
    customerName: 'Full name',
    phone: 'Phone number',
    email: 'Email for order updates (optional)',
    fulfillment: 'How would you like to receive it?',
    pickup: 'Pick up at store',
    delivery: 'Delivery',
    deliveryAddress: 'Delivery address',
    deliveryFeeUnknown: 'The store will confirm the delivery fee.',
    subtotal: 'Items subtotal',
    total: 'Order total',
    quotePending: 'The store will confirm the final price and any delivery fee before processing.',
    orderNotes: 'Order notes',
    quantity: 'Quantity',
    remove: 'Remove',
    submitOrder: 'Place order request',
    submitting: 'Submitting...',
    orderSubmitted: 'Your order request is recorded.',
    orderNumber: 'Order number',
    privacyConsent: 'I agree that my details may be stored to process this order.',
    emptyCart: 'Your order bag is empty.',
    orderFailed: 'Could not submit the order. Please try again or contact the store.',
  },
}

const colorPreviewFilters = {
  NAVY: 'saturate(.88) brightness(.86) contrast(1.06)',
  WHITE: 'saturate(.78) brightness(1.08)',
  GREY: 'grayscale(.24) brightness(.98)',
  MAROON: 'sepia(.24) hue-rotate(292deg) saturate(.86)',
}

const whatsappPhone = '9647728223939'
const whatsappUrl = (message) => `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
const mapUrl = 'https://www.google.com/maps/search/?api=1&query=Khwar+Flkay+Khala+Haji+next+to+Hawal+Home+Furniture+Sulaymaniyah'
const mapEmbed = 'https://maps.google.com/maps?q=Hawal%20Home%20Furniture%2C%20Khwar%20Flkay%20Khala%20Haji%2C%20Sulaymaniyah&t=&z=16&ie=UTF8&iwloc=&output=embed'

function getProductSelection(product, selectedColorCode, selectedSizeCode) {
  const variants = product.variants || []
  const availableVariants = variants.filter((variant) => variant.isAvailable)
  const selectedColor = variants.find((variant) => variant.colorCode === selectedColorCode && variant.isAvailable)
    || availableVariants[0]
    || variants[0]
  const variantsForColor = selectedColor
    ? variants.filter((variant) => variant.colorCode === selectedColor.colorCode)
    : []
  const selectedVariant = variantsForColor.find((variant) => variant.sizeCode === selectedSizeCode && variant.isAvailable)
    || variantsForColor.find((variant) => variant.sizeCode === 'M' && variant.isAvailable)
    || variantsForColor.find((variant) => variant.isAvailable)
    || variantsForColor[0]

  return { colorCode: selectedColor?.colorCode, variant: selectedVariant, variantsForColor }
}

function getVariantGallery(product, selectedColorCode, selectedSizeCode) {
  const selection = getProductSelection(product, selectedColorCode, selectedSizeCode)
  const selectedVariant = selection.variant
  const gallery = selectedVariant?.gallery?.length
    ? selectedVariant.gallery
    : product.imageUrl
      ? [{ url: product.imageUrl, altText: product.imageAlt || product.name }]
      : []

  return gallery.map((image) => ({
    url: image.url,
    altText: image.altText || image.alt || product.name,
  }))
}

function formatPrice(priceMinor, currency, language) {
  if (priceMinor === null || priceMinor === undefined) return null
  const locale = language === 'ku' ? 'ckb-IQ' : 'en-IQ'
  const fractionDigits = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
  const value = Number(priceMinor) / (10 ** fractionDigits)
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

/* ─── Image helpers ─── */
function ImgWrap({ src, alt, loading = 'lazy', objectPosition = 'center' }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={`img-wrap${loaded ? ' loaded' : ''}`}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        style={{ objectFit: 'cover', objectPosition }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

function HeroImg({ src, alt }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      className={`hero-image ${loaded ? 'loaded' : 'loading'}`}
      src={src}
      alt={alt}
      fetchPriority="high"
      onLoad={() => setLoaded(true)}
    />
  )
}

function OrderFormModal({ cartLines, locale, language, text, onClose, onQuantityChange, onRemove, onOrderCreated }) {
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [fulfillmentMethod, setFulfillmentMethod] = useState('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [note, setNote] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submittedOrder, setSubmittedOrder] = useState(null)
  const allPricesKnown = cartLines.length > 0 && cartLines.every((line) => line.variant.priceMinor !== null)
  const currency = cartLines[0]?.variant.currency || 'IQD'
  const sameCurrency = cartLines.every((line) => line.variant.currency === currency)
  const subtotalMinor = allPricesKnown && sameCurrency
    ? cartLines.reduce((sum, line) => sum + (line.variant.priceMinor * line.quantity), 0)
    : null
  const deliveryMinor = fulfillmentMethod === 'pickup' ? 0 : null
  const totalMinor = subtotalMinor === null || deliveryMinor === null ? null : subtotalMinor + deliveryMinor

  async function submitOrder(event) {
    event.preventDefault()
    if (!privacyAccepted || cartLines.length === 0 || cartLines.some((line) => !line.variant.isAvailable)) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          customerName,
          phone,
          email,
          fulfillmentMethod,
          deliveryAddress,
          note,
          privacyAccepted: true,
          items: cartLines.map((line) => ({ variantId: line.variant.id, quantity: line.quantity })),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || text.orderFailed)
      setSubmittedOrder(result.order)
      onOrderCreated()
    } catch (requestError) {
      setError(requestError.message || text.orderFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="order-modal" role="dialog" aria-modal="true" aria-label={submittedOrder ? text.orderSubmitted : text.orderFormTitle}>
        <button className="modal-close icon-button" type="button" aria-label={text.close} onClick={onClose}><X size={19} /></button>
        {submittedOrder ? (
          <div className="order-success" role="status">
            <span className="order-success-icon"><Check size={22} /></span>
            <p className="eyebrow">{text.orderSubmitted}</p>
            <h2>{text.orderNumber}: {submittedOrder.orderNumber}</h2>
            <p>{text.orderSubmitted}</p>
            <strong>{submittedOrder.totalConfirmed ? formatPrice(submittedOrder.totalMinor, submittedOrder.currency, language) : text.quotePending}</strong>
            <button className="button button-blue" type="button" onClick={onClose}>{text.close}</button>
          </div>
        ) : cartLines.length === 0 ? (
          <div className="order-success"><p>{text.emptyCart}</p><button className="button button-blue" type="button" onClick={onClose}>{text.close}</button></div>
        ) : (
          <form className="order-form" onSubmit={submitOrder}>
            <span className="eyebrow"><i />{text.cart}</span>
            <h2>{text.orderFormTitle}</h2>
            <p className="order-form-intro">{text.orderFormIntro}</p>

            <div className="checkout-lines">
              {cartLines.map((line) => (
                <div className="checkout-line" key={line.variant.id}>
                  <div className="checkout-line-heading"><strong>{line.product.name}</strong><button className="remove-line" type="button" onClick={() => onRemove(line.variant.id)}>{text.remove}</button></div>
                  <span>{line.variant.colorName} · {line.variant.sizeLabel} · {formatPrice(line.variant.priceMinor, line.variant.currency, language) || text.priceInquiry}</span>
                  <label className="quantity-field">{text.quantity}<input type="number" min="1" max="10" value={line.quantity} onChange={(event) => onQuantityChange(line.variant.id, Number(event.target.value))} required /></label>
                </div>
              ))}
            </div>

            <div className="checkout-summary">
              <div><span>{text.subtotal}</span><strong>{subtotalMinor === null ? text.priceInquiry : formatPrice(subtotalMinor, currency, language)}</strong></div>
              {fulfillmentMethod === 'delivery' && <p>{text.deliveryFeeUnknown}</p>}
              <div className="checkout-total"><span>{text.total}</span><strong>{totalMinor === null ? text.quotePending : formatPrice(totalMinor, currency, language)}</strong></div>
            </div>

            <div className="order-fields">
              <label>{text.customerName}<input autoComplete="name" minLength="2" maxLength="120" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label>
              <label>{text.phone}<input type="tel" autoComplete="tel" minLength="7" maxLength="24" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
              <label>{text.email}<input type="email" autoComplete="email" maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>{text.fulfillment}<select value={fulfillmentMethod} onChange={(event) => setFulfillmentMethod(event.target.value)}><option value="pickup">{text.pickup}</option><option value="delivery">{text.delivery}</option></select></label>
              {fulfillmentMethod === 'delivery' && <label className="delivery-address-field">{text.deliveryAddress}<textarea rows="2" maxLength="500" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} required /></label>}
              <label className="order-note-field">{text.orderNotes}<textarea rows="2" maxLength="1000" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            </div>

            <label className="privacy-consent"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} required /><span>{text.privacyConsent}</span></label>
            {error && <p className="admin-error" role="alert">{error}</p>}
            <button className="button button-blue order-submit" type="submit" disabled={submitting || !privacyAccepted || cartLines.some((line) => !line.variant.isAvailable)}>{submitting ? text.submitting : text.submitOrder}<ArrowUpRight size={15} /></button>
          </form>
        )}
      </section>
    </div>
  )
}

function App() {
  const pageViewRecorded = useRef(false)
  const [language, setLanguage] = useState('ku')
  const [activeStage, setActiveStage] = useState('all')
  const [selectedColors, setSelectedColors] = useState({})
  const [selectedSizes, setSelectedSizes] = useState({})
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [quickView, setQuickView] = useState(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [cartItems, setCartItems] = useState([])
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [catalog, setCatalog] = useState({ stages: [], colors: [], sizes: [], sizeGuide: {}, products: [] })
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [catalogStatusLocale, setCatalogStatusLocale] = useState(null)
  const [catalogRetry, setCatalogRetry] = useState(0)
  const text = copy[language]
  const locale = language === 'ku' ? 'ckb' : 'en'
  const catalogPending = catalogStatus === 'loading' || catalogStatusLocale !== locale
  const visibleProducts = catalog.locale !== locale
    ? []
    : activeStage === 'all'
      ? catalog.products
      : catalog.products.filter((product) => product.stageCode === activeStage)

  useEffect(() => {
    if (pageViewRecorded.current) return
    pageViewRecorded.current = true
    fetch('/api/analytics/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname }),
      keepalive: true,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Page view endpoint returned HTTP ${response.status}.`)
      })
      .catch((error) => console.warn('Unable to record anonymous page view.', error))
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/catalog?locale=${locale}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Catalog request failed')
        return response.json()
      })
      .then((result) => {
        setCatalog(result)
        setCatalogStatusLocale(result.locale)
        setCatalogStatus('ready')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setCatalogStatusLocale(locale)
          setCatalogStatus('error')
        }
      })

    return () => controller.abort()
  }, [locale, catalogRetry])

  useEffect(() => {
    document.documentElement.lang = language === 'ku' ? 'ckb' : 'en'
    document.documentElement.dir = text.direction
  }, [language, text.direction])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [activeStage, catalog])

  useEffect(() => {
    if (!quickView) return undefined
    setGalleryIndex(0)
    const closeOnEscape = (event) => event.key === 'Escape' && setQuickView(null)
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [quickView, selectedColors[quickView?.id], selectedSizes[quickView?.id]])

  const productName = (product) => product.name
  const detailProduct = selectedProductId ? catalog.products.find((product) => product.id === selectedProductId) : quickView
  const detailSelection = detailProduct ? getProductSelection(detailProduct, selectedColors[detailProduct.id], selectedSizes[detailProduct.id]) : null
  const detailGallery = detailProduct ? getVariantGallery(detailProduct, selectedColors[detailProduct.id], selectedSizes[detailProduct.id]) : []
  const stageName = (stageCode) => {
    const stage = catalog.stages.find((item) => item.code === stageCode)
    if (!stage) return stageCode
    return language === 'ku' ? `قۆناغی ${stage.name}` : stage.name
  }
  const quickSelection = quickView
    ? getProductSelection(quickView, selectedColors[quickView.id], selectedSizes[quickView.id])
    : null
  const cartLines = cartItems.map((item) => {
    const product = catalog.products.find((entry) => entry.id === item.productId)
    const variant = product?.variants.find((entry) => entry.id === item.variantId)
    return product && variant ? { ...item, product, variant } : null
  }).filter(Boolean)

  function addToOrder(product, variant) {
    if (!variant?.isAvailable) return
    setCartItems((items) => {
      const existing = items.find((item) => item.variantId === variant.id)
      return existing
        ? items.map((item) => item.variantId === variant.id ? { ...item, quantity: Math.min(item.quantity + 1, 10) } : item)
        : [...items, { productId: product.id, variantId: variant.id, quantity: 1 }]
    })
    setSelectedProductId(null)
    setQuickView(null)
    setOrderFormOpen(true)
  }

  function setCartQuantity(variantId, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) return
    setCartItems((items) => items.map((item) => item.variantId === variantId ? { ...item, quantity: Math.min(quantity, 10) } : item))
  }

  return (
    <>
      <div className="topline">
        <div className="topline-inner">
          <a href={mapUrl} target="_blank" rel="noreferrer" className="top-location"><MapPin size={13} />{text.location}</a>
          <span className="top-hours">{text.contactLine}</span>
        </div>
      </div>

      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#home" aria-label="POSHRAW.Co home">
            <span>POSHRAW<span className="brand-dot">.</span>Co</span>
            <small>پۆشراو</small>
          </a>
          <nav className={`main-nav ${menuOpen ? 'menu-open' : ''}`} aria-label="Main navigation">
            <a href="#collection" onClick={() => setMenuOpen(false)}>{text.shop}</a>
            <a href="#story" onClick={() => setMenuOpen(false)}>{text.madeFor}</a>
            <a href="#visit" onClick={() => setMenuOpen(false)}>{text.visit}</a>
            <a href="#policies" onClick={() => setMenuOpen(false)}>{text.policies}</a>
          </nav>
          <div className="header-actions">
            <div className="language-switch" aria-label="Language">
              <button className={language === 'ku' ? 'active' : ''} type="button" onClick={() => setLanguage('ku')} aria-pressed={language === 'ku'}>کوردی</button>
              <span aria-hidden="true" />
              <button className={language === 'en' ? 'active' : ''} type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
            </div>
            <button className="header-cart icon-button" type="button" aria-label={`${text.cart}: ${cartItems.length}`} onClick={() => { setQuickView(null); setOrderFormOpen(true) }}><ShoppingBag size={17} /><span>{cartItems.length}</span></button>
            <a className="header-order" href={whatsappUrl('Hello POSHRAW.Co, I would like to ask about your school uniforms.')} target="_blank" rel="noreferrer">{text.whatsapp}<ArrowUpRight size={15} /></a>
            <button className="menu-toggle icon-button" type="button" aria-label={menuOpen ? text.close : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-wrap" id="home">
          <div className="hero">
            <img className="hero-image" src="https://images.unsplash.com/photo-1612229693210-30e16029c415?auto=format&fit=crop&w=1900&q=85" alt="Schoolchildren wearing uniforms together" fetchPriority="high" />
            <div className="hero-shade" />
            <div className="hero-content">
              <span className="eyebrow hero-eyebrow"><i />{text.collection}</span>
              <h1>{text.headline}</h1>
              <p>{text.intro}</p>
              <div className="hero-buttons">
                <a className="button button-blue" href="#collection">{text.browse}<ArrowUpRight size={16} /></a>
                <a className="button button-outline" href={whatsappUrl('Hello POSHRAW.Co, I would like to ask about your school uniforms.')} target="_blank" rel="noreferrer">{text.whatsapp}</a>
              </div>
            </div>
            <div className="hero-caption"><span className="caption-line" />{text.crafted}</div>
            <span className="hero-index">01 <span>/</span> 04</span>
          </div>
          <a className="scroll-cue" href="#collection" aria-label={text.browse}><ArrowDown size={15} /><span>SCROLL TO DISCOVER</span></a>
        </section>

        <section className="collection section-shell" id="collection">
          <div className="section-heading reveal">
            <div>
              <span className="eyebrow"><i />{text.shop}</span>
              <h2>{text.shopTitle}<br /><em>{text.shopEmphasis}</em></h2>
            </div>
            <p className="collection-note">{text.intro}</p>
          </div>

          <div className="filter-row" role="tablist" aria-label={text.shop}>
            <button type="button" role="tab" aria-selected={activeStage === 'all'} className={`filter-pill ${activeStage === 'all' ? 'active' : ''}`} onClick={() => setActiveStage('all')}>{text.all}</button>
            {catalog.stages.map((stage) => (
              <button key={stage.code} type="button" role="tab" aria-selected={activeStage === stage.code} className={`filter-pill ${activeStage === stage.code ? 'active' : ''}`} onClick={() => setActiveStage(stage.code)}>
                {language === 'ku' ? `قۆناغی ${stage.name}` : stage.name}
              </button>
            ))}
            <span className="piece-count">{String(visibleProducts.length).padStart(2, '0')} {text.pieces}</span>
          </div>

          <div className={`product-grid ${visibleProducts.length === 1 ? 'single-result' : ''}`}>
            {catalogPending && <p className="catalog-state">{text.loadingCatalog}</p>}
            {catalogStatus === 'error' && catalogStatusLocale === locale && (
              <div className="catalog-state" role="alert">
                <p>{text.catalogFailed}</p>
                <button type="button" onClick={() => { setCatalogStatus('loading'); setCatalogRetry((retry) => retry + 1) }}>{text.retry}</button>
              </div>
            )}
            {visibleProducts.map((product, index) => {
              const selection = getProductSelection(product, selectedColors[product.id], selectedSizes[product.id])
              const color = catalog.colors.find((item) => item.code === selection.colorCode)
              const variant = selection.variant
              const colorOptions = catalog.colors.filter((item) => product.variants.some((option) => option.colorCode === item.code))
              const gallery = getVariantGallery(product, selectedColors[product.id], selectedSizes[product.id])
              const image = gallery[0] || { url: product.imageUrl, altText: product.imageAlt || productName(product) }
              const price = formatPrice(variant?.priceMinor ?? product.priceMinor, variant?.currency || product.currency, language)
              return (
                <article className="product-card reveal" key={product.id} style={{ '--reveal-delay': `${index * 75}ms` }}>
                  <div className="product-photo">
                    {image.url && <img src={image.url} alt={image.altText || productName(product)} loading="lazy" style={{ objectPosition: 'center' }} />}
                    <span className="stage-tag">{stageName(product.stageCode)}</span>
                    <button className="quick-view" type="button" onClick={() => { setSelectedProductId(product.id); setQuickView(product) }}>{text.quickView}<ArrowUpRight size={14} /></button>
                  </div>
                  <div className="product-info">
                    <div className="product-title-row">
                      <h3>{productName(product)}</h3>
                      <span className="product-price">{price || text.priceInquiry}</span>
                    </div>
                    <p className="product-description">{product.shortDescription}</p>
                    <span className={`stock-state ${variant?.isAvailable ? 'in-stock' : 'out-of-stock'}`}>
                      {variant?.trackInventory
                        ? variant.stockOnHand > 0 ? `${variant.stockOnHand} ${text.inStock}` : text.outOfStock
                        : text.stockUntracked}
                    </span>
                    <div className="product-options">
                      <div className="swatches" role="group" aria-label={text.chooseColor}>
                        {colorOptions.map((item) => {
                          const hasStock = product.variants.some((option) => option.colorCode === item.code && option.isAvailable)
                          return <button key={item.code} type="button" className={`swatch ${color?.code === item.code ? 'selected' : ''}`} style={{ '--swatch': item.hexValue }} aria-label={item.name} aria-pressed={color?.code === item.code} disabled={!hasStock} onClick={() => setSelectedColors({ ...selectedColors, [product.id]: item.code })} />
                        })}
                      </div>
                      <div className="size-list" aria-label={text.available}>{catalog.sizes.map((item) => {
                        const sizeVariant = selection.variantsForColor.find((option) => option.sizeCode === item.code)
                        return <button key={item.code} type="button" className={variant?.sizeCode === item.code ? 'selected' : ''} aria-pressed={variant?.sizeCode === item.code} disabled={!sizeVariant?.isAvailable} onClick={() => setSelectedSizes({ ...selectedSizes, [product.id]: item.code })}>{item.label}</button>
                      })}</div>
                    </div>
                    <div className="product-actions">
                      <button className="text-action" type="button" onClick={() => { setSelectedProductId(product.id); setQuickView(product) }}>{text.quickView}<ArrowUpRight size={14} /></button>
                      <button className={`order-action ${variant?.isAvailable ? '' : 'unavailable'}`} type="button" disabled={!variant?.isAvailable} onClick={() => addToOrder(product, variant)}>{text.order}<ArrowUpRight size={14} /></button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="brand-story section-shell reveal">
          <div className="brand-story-copy">
            <span className="eyebrow"><i />{text.whyChooseUs}</span>
            <h2>{text.whyChooseUsTitle}</h2>
            <p>{text.whyChooseUsText}</p>
          </div>
        </section>

        {detailProduct && (
          <section className="product-detail-showcase section-shell reveal">
            <div className="product-detail-gallery">
              <div className="detail-main-image">{detailGallery[0] && <img src={detailGallery[0].url} alt={detailGallery[0].altText || detailProduct.name} />}</div>
              <div className="detail-thumb-grid">{detailGallery.slice(0, 4).map((image, index) => <button key={`${image.url}-${index}`} type="button" className="detail-thumb" onClick={() => setGalleryIndex(index)}><img src={image.url} alt={image.altText || detailProduct.name} /></button>)}</div>
            </div>
            <div className="product-detail-copy">
              <span className="eyebrow"><i />{stageName(detailProduct.stageCode)}</span>
              <h2>{detailProduct.name}</h2>
              <p className="product-detail-price">{formatPrice(detailSelection?.variant?.priceMinor ?? detailProduct.priceMinor, detailSelection?.variant?.currency || detailProduct.currency, language) || text.priceInquiry}</p>
              <p className="detail-description">{detailProduct.description}</p>

              <div className="detail-info-grid">
                <div><span>Material</span><strong>{detailProduct.material || 'School uniform fabric'}</strong></div>
                <div><span>Care</span><strong>{detailProduct.careInstructions || 'Warm wash, line dry'}</strong></div>
              </div>

              <div className="detail-choice-block">
                <label className="option-label">{text.color}<strong>{detailSelection?.variant?.colorName}</strong></label>
                <div className="swatches modal-swatches" role="group" aria-label={text.chooseColor}>{catalog.colors.filter((item) => detailProduct.variants.some((variant) => variant.colorCode === item.code)).map((item) => <button key={item.code} type="button" className={`swatch ${detailSelection?.colorCode === item.code ? 'selected' : ''}`} style={{ '--swatch': item.hexValue }} aria-label={item.name} aria-pressed={detailSelection?.colorCode === item.code} disabled={!detailProduct.variants.some((variant) => variant.colorCode === item.code && variant.isAvailable)} onClick={() => setSelectedColors({ ...selectedColors, [detailProduct.id]: item.code })} />)}</div>
              </div>

              <div className="detail-choice-block">
                <label className="option-label size-label">{text.size}<strong>{detailSelection?.variant?.sizeLabel}</strong></label>
                <div className="modal-sizes">{catalog.sizes.map((item) => {
                  const sizeVariant = detailSelection?.variantsForColor.find((variant) => variant.sizeCode === item.code)
                  return <button key={item.code} type="button" className={detailSelection?.variant?.sizeCode === item.code ? 'selected' : ''} aria-pressed={detailSelection?.variant?.sizeCode === item.code} disabled={!sizeVariant?.isAvailable} onClick={() => setSelectedSizes({ ...selectedSizes, [detailProduct.id]: item.code })}>{item.label}</button>
                })}</div>
              </div>

              <div className="detail-size-guide">
                <h3>{language === 'ku' ? 'ڕێنمایی قەبارە' : 'Size guide'}</h3>
                <div className="size-guide-header">
                  <span>{language === 'ku' ? 'قەبارە' : 'Size'}</span>
                  <span>{language === 'ku' ? 'تەمەن' : 'Age'}</span>
                  <span>{language === 'ku' ? 'بەرزی' : 'Height'}</span>
                </div>
                {(catalog.sizeGuide?.[detailProduct.stageCode]?.entries || []).map((entry) => (
                  <div key={entry.sizeCode} className={`size-guide-row ${detailSelection?.variant?.sizeCode === entry.sizeCode ? 'selected' : ''}`}>
                    <strong>{entry.sizeCode}</strong>
                    <span>{entry.ageRange || '—'}</span>
                    <span>{entry.heightRange || '—'}</span>
                  </div>
                ))}
                {(catalog.sizeGuide?.[detailProduct.stageCode]?.entries || []).length > 0 && (
                  <p className="size-guide-note">{catalog.sizeGuide[detailProduct.stageCode].entries.find((entry) => entry.sizeCode === detailSelection?.variant?.sizeCode)?.fitNote || catalog.sizeGuide[detailProduct.stageCode].entries[0].fitNote}</p>
                )}
              </div>

              <div className="detail-shipping-box">
                <h3>Delivery</h3>
                <p>Ask us to confirm delivery availability in Sulaymaniyah before ordering. We’ll guide you to the best pickup or delivery option.</p>
              </div>

              <button className="button button-blue modal-order" type="button" onClick={() => { setQuickView(detailProduct); setOrderFormOpen(true) }}>{text.order}<ArrowUpRight size={16} /></button>
            </div>
          </section>
        )}

        <section className="story-band" id="story">
          <div className="story-inner section-shell reveal">
            <span className="eyebrow"><i />{text.madeFor}</span>
            <p>{text.footerLine}</p>
            <span className="story-mark">P<span>.</span></span>
          </div>
        </section>

        <section className="visit-section section-shell" id="visit">
          <div className="visit-copy reveal">
            <span className="eyebrow"><i />{text.visit}</span>
            <h2>{text.locationTitle}</h2>
            <p>{text.address}</p>
            <div className="hours-notice"><Clock3 size={16} /><div><strong>{text.openingHours}</strong><p>{text.openingHoursUnknown}</p></div></div>
            <a className="button button-blue directions-button" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={16} />{text.directions}<ArrowUpRight size={15} /></a>
            <div className="visit-meta">
              <span><MapPin size={15} />Sulaymaniyah, Kurdistan Region</span>
              <a href="https://www.instagram.com/poshraw.co/" target="_blank" rel="noreferrer">@poshraw.co<ArrowUpRight size={13} /></a>
            </div>
          </div>
          <div className="map-frame reveal">
            <iframe title="POSHRAW.Co store location near Khala Haji circle in Sulaymaniyah" src={mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <a className="map-label" href={mapUrl} target="_blank" rel="noreferrer"><span className="map-pin"><MapPin size={17} /></span><span><strong>POSHRAW.Co</strong><small>{text.mapLabel}</small></span><ArrowUpRight size={15} /></a>
          </div>
        </section>

        <section className="policy-band" id="policies">
          <div className="policy-section section-shell">
            <div className="policy-heading reveal">
              <div><span className="eyebrow"><i />{text.policyEyebrow}</span><h2>{text.policyTitle}</h2></div>
              <p>{text.policyIntro}</p>
            </div>
            <div className="policy-grid">
              <article className="policy-item reveal"><Truck size={19} /><h3>{text.deliveryTitle}</h3><p>{text.deliveryText}</p></article>
              <article className="policy-item reveal"><RefreshCw size={19} /><h3>{text.returnsTitle}</h3><p>{text.returnsText}</p></article>
              <article className="policy-item reveal"><ShieldCheck size={19} /><h3>{text.privacyTitle}</h3><p>{text.privacyText}</p></article>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main section-shell">
          <div className="footer-brand-block">
            <a className="brand brand-footer" href="#home"><span>POSHRAW<span className="brand-dot">.</span>Co</span><small>پۆشراو</small></a>
            <p>{text.footerLine}</p>
          </div>
          <div className="footer-column"><span>{text.contact}</span><a href={whatsappUrl('Hello POSHRAW.Co')} target="_blank" rel="noreferrer"><Phone size={14} />WhatsApp<ArrowUpRight size={13} /></a><a href="https://www.instagram.com/poshraw.co/" target="_blank" rel="noreferrer">Instagram<ArrowUpRight size={13} /></a></div>
          <div className="footer-column"><span>{text.follow}</span><a href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={14} />Sulaymaniyah<ArrowUpRight size={13} /></a><a href="/admin">{text.adminLink}<ArrowUpRight size={13} /></a><span className="footer-hours">{text.contactLine}</span></div>
        </div>
        <div className="footer-bottom section-shell"><span>© 2026 POSHRAW.Co</span><span>Made for the school days ahead <Check size={13} /></span></div>
      </footer>

      {!quickView && !orderFormOpen && (
        <nav className="mobile-action-bar" aria-label={text.order}>
          <button className="mobile-cart-action" type="button" onClick={() => setOrderFormOpen(true)}>
            <ShoppingBag size={18} />
            <span>{text.cart}</span>
            <span className="mobile-cart-count">{cartItems.length}</span>
          </button>
          <a className="mobile-whatsapp-action" href={whatsappUrl('Hello POSHRAW.Co, I would like to ask about your school uniforms.')} target="_blank" rel="noreferrer">
            <MessageCircle size={18} />
            <span>{text.whatsapp}</span>
          </a>
        </nav>
      )}

      {quickView && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedProductId(null)
            setQuickView(null)
          }
        }}>
          <section className="quick-modal" role="dialog" aria-modal="true" aria-label={productName(quickView)}>
            <button className="modal-close icon-button" type="button" aria-label={text.close} onClick={() => { setSelectedProductId(null); setQuickView(null) }}><X size={19} /></button>
            <div className="modal-gallery-wrap">
              <div className="modal-image">{
                (() => {
                  const gallery = getVariantGallery(
                    quickView,
                    quickSelection?.colorCode,
                    quickSelection?.variant?.sizeCode,
                  )
                  const activeImage = gallery[galleryIndex] || gallery[0] || { url: quickView.imageUrl, altText: quickView.imageAlt || productName(quickView) }
                  return activeImage.url ? <img src={activeImage.url} alt={activeImage.altText || productName(quickView)} style={{ objectPosition: 'center' }} /> : null
                })()
              }</div>
              <div className="modal-gallery-thumbs">{getVariantGallery(
                quickView,
                quickSelection?.colorCode,
                quickSelection?.variant?.sizeCode,
              ).map((image, index) => (
                <button key={`${image.url}-${index}`} type="button" className={`gallery-thumb ${galleryIndex === index ? 'selected' : ''}`} aria-label={`View product image ${index + 1}`} onClick={() => setGalleryIndex(index)}>
                  <img src={image.url} alt={image.altText || productName(quickView)} />
                </button>
              ))}</div>
            </div>
            <div className="modal-details">
              <span className="eyebrow"><i />{stageName(quickView.stageCode)}</span>
              <h2>{productName(quickView)}</h2>
              <span className="modal-price">{formatPrice(quickSelection?.variant?.priceMinor ?? quickView.priceMinor, quickSelection?.variant?.currency || quickView.currency, language) || text.priceInquiry}</span>
              <p className="modal-description">{quickView.description}</p>
              <div className="modal-rule" />
              <span className="details-heading">{text.details}</span>
              <div className="product-detail-row"><span>{text.schoolStage}</span><strong>{stageName(quickView.stageCode)}</strong></div>
              <div className="product-detail-row"><span>{text.available}</span><strong>{catalog.sizes.filter((item) => quickView.variants.some((variant) => variant.sizeCode === item.code && variant.colorCode === quickSelection?.colorCode && variant.isAvailable)).map((item) => item.label).join(' · ')}</strong></div>
              <div className="product-detail-row"><span>{text.stock}</span><strong>{quickSelection?.variant?.trackInventory ? quickSelection.variant.stockOnHand > 0 ? quickSelection.variant.stockOnHand : text.outOfStock : text.stockUntracked}</strong></div>
              <label className="option-label">{text.color}<strong>{quickSelection?.variant?.colorName}</strong></label>
              <div className="swatches modal-swatches" role="group" aria-label={text.chooseColor}>{catalog.colors.filter((item) => quickView.variants.some((variant) => variant.colorCode === item.code)).map((item) => <button key={item.code} type="button" className={`swatch ${quickSelection?.colorCode === item.code ? 'selected' : ''}`} style={{ '--swatch': item.hexValue }} aria-label={item.name} aria-pressed={quickSelection?.colorCode === item.code} disabled={!quickView.variants.some((variant) => variant.colorCode === item.code && variant.isAvailable)} onClick={() => setSelectedColors({ ...selectedColors, [quickView.id]: item.code })} />)}</div>
              <label className="option-label size-label">{text.size}<strong>{quickSelection?.variant?.sizeLabel}</strong></label>
              <div className="modal-sizes">{catalog.sizes.map((item) => {
                const sizeVariant = quickSelection?.variantsForColor.find((variant) => variant.sizeCode === item.code)
                return <button key={item.code} type="button" className={quickSelection?.variant?.sizeCode === item.code ? 'selected' : ''} aria-pressed={quickSelection?.variant?.sizeCode === item.code} disabled={!sizeVariant?.isAvailable} onClick={() => setSelectedSizes({ ...selectedSizes, [quickView.id]: item.code })}>{item.label}</button>
              })}</div>
              <div className="size-guide-panel">
                <span className="details-heading">{language === 'ku' ? 'ڕێنمایی قەبارە' : 'Size guide'}</span>
                <div className="size-guide-header">
                  <span>{language === 'ku' ? 'قەبارە' : 'Size'}</span>
                  <span>{language === 'ku' ? 'تەمەن' : 'Age'}</span>
                  <span>{language === 'ku' ? 'بەرزی' : 'Height'}</span>
                </div>
                {(catalog.sizeGuide?.[quickView.stageCode]?.entries || []).map((entry) => (
                  <div key={entry.sizeCode} className={`size-guide-row ${quickSelection?.variant?.sizeCode === entry.sizeCode ? 'selected' : ''}`}>
                    <strong>{entry.sizeCode}</strong>
                    <span>{entry.ageRange || '—'}</span>
                    <span>{entry.heightRange || '—'}</span>
                  </div>
                ))}
                {catalog.sizeGuide?.[quickView.stageCode]?.entries?.[0] && (
                  <p className="size-guide-note">{catalog.sizeGuide[quickView.stageCode].entries.find((entry) => entry.sizeCode === quickSelection?.variant?.sizeCode)?.fitNote || catalog.sizeGuide[quickView.stageCode].entries[0].fitNote}</p>
                )}
              </div>
              <button className={`button button-blue modal-order ${quickSelection?.variant?.isAvailable ? '' : 'unavailable'}`} type="button" disabled={!quickSelection?.variant?.isAvailable} onClick={() => addToOrder(quickView, quickSelection?.variant)}>{text.order}<ArrowUpRight size={16} /></button>
              <p className="modal-note"><MapPin size={13} />{text.address}</p>
            </div>
          </section>
        </div>
      )}
      {orderFormOpen && (
        <OrderFormModal
          cartLines={cartLines}
          locale={locale}
          language={language}
          text={text}
          onClose={() => setOrderFormOpen(false)}
          onQuantityChange={setCartQuantity}
          onRemove={(variantId) => setCartItems((items) => items.filter((item) => item.variantId !== variantId))}
          onOrderCreated={() => setCartItems([])}
        />
      )}
    </>
  )
}

export default App
