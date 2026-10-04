CREATE TABLE IF NOT EXISTS school_stages (
    code text PRIMARY KEY,
    sort_order smallint NOT NULL UNIQUE CHECK (sort_order > 0),
    name_en text NOT NULL,
    name_ckb text NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    stage_code text NOT NULL REFERENCES school_stages(code) ON UPDATE CASCADE ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    currency char(3) NOT NULL DEFAULT 'IQD' CHECK (currency ~ '^[A-Z]{3}$'),
    price_minor bigint CHECK (price_minor IS NULL OR price_minor >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,
    CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS product_translations (
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    locale text NOT NULL CHECK (locale IN ('en', 'ckb')),
    name text NOT NULL,
    short_description text NOT NULL,
    description text NOT NULL,
    material text,
    care_instructions text,
    PRIMARY KEY (product_id, locale)
);

CREATE TABLE IF NOT EXISTS product_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    alt_text text NOT NULL,
    image_role text NOT NULL DEFAULT 'gallery' CHECK (image_role IN ('card', 'gallery', 'detail')),
    sort_order smallint NOT NULL DEFAULT 1 CHECK (sort_order > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id, image_role, sort_order)
);

CREATE TABLE IF NOT EXISTS color_options (
    code text PRIMARY KEY,
    name_en text NOT NULL,
    name_ckb text NOT NULL,
    hex_value char(7) NOT NULL CHECK (hex_value ~ '^#[0-9A-Fa-f]{6}$'),
    sort_order smallint NOT NULL UNIQUE CHECK (sort_order > 0),
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sizes (
    code text PRIMARY KEY,
    label text NOT NULL,
    sort_order smallint NOT NULL UNIQUE CHECK (sort_order > 0),
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_code text NOT NULL REFERENCES color_options(code) ON UPDATE CASCADE ON DELETE RESTRICT,
    size_code text NOT NULL REFERENCES sizes(code) ON UPDATE CASCADE ON DELETE RESTRICT,
    variant_sku text NOT NULL UNIQUE,
    price_minor bigint CHECK (price_minor IS NULL OR price_minor >= 0),
    currency char(3) NOT NULL DEFAULT 'IQD' CHECK (currency ~ '^[A-Z]{3}$'),
    track_inventory boolean NOT NULL DEFAULT false,
    stock_on_hand integer CHECK (stock_on_hand IS NULL OR stock_on_hand >= 0),
    low_stock_threshold integer NOT NULL DEFAULT 2 CHECK (low_stock_threshold >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT track_inventory OR stock_on_hand IS NOT NULL),
    UNIQUE (product_id, color_code, size_code)
);

CREATE TABLE IF NOT EXISTS variant_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    alt_text text NOT NULL,
    view_label text NOT NULL DEFAULT 'front' CHECK (view_label IN ('front', 'back', 'detail', 'other')),
    sort_order smallint NOT NULL DEFAULT 1 CHECK (sort_order > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (variant_id, sort_order)
);

CREATE TABLE IF NOT EXISTS size_guide_entries (
    stage_code text NOT NULL REFERENCES school_stages(code) ON UPDATE CASCADE ON DELETE CASCADE,
    size_code text NOT NULL REFERENCES sizes(code) ON UPDATE CASCADE ON DELETE CASCADE,
    age_min_months smallint CHECK (age_min_months IS NULL OR age_min_months >= 0),
    age_max_months smallint CHECK (age_max_months IS NULL OR age_max_months >= 0),
    height_min_cm numeric(5, 1) CHECK (height_min_cm IS NULL OR height_min_cm > 0),
    height_max_cm numeric(5, 1) CHECK (height_max_cm IS NULL OR height_max_cm > 0),
    chest_cm numeric(5, 1) CHECK (chest_cm IS NULL OR chest_cm > 0),
    waist_cm numeric(5, 1) CHECK (waist_cm IS NULL OR waist_cm > 0),
    hip_cm numeric(5, 1) CHECK (hip_cm IS NULL OR hip_cm > 0),
    fit_note_en text,
    fit_note_ckb text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (stage_code, size_code),
    CHECK (age_min_months IS NULL OR age_max_months IS NULL OR age_max_months >= age_min_months),
    CHECK (height_min_cm IS NULL OR height_max_cm IS NULL OR height_max_cm >= height_min_cm)
);

CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    phone text,
    email text,
    preferred_locale text NOT NULL DEFAULT 'ckb' CHECK (preferred_locale IN ('en', 'ckb')),
    marketing_consent boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label text NOT NULL DEFAULT 'Home',
    recipient_name text NOT NULL,
    phone text,
    address_line text NOT NULL,
    city text NOT NULL,
    region text,
    country_code char(2) NOT NULL DEFAULT 'IQ' CHECK (country_code ~ '^[A-Z]{2}$'),
    postal_code text,
    delivery_notes text,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_setup_state (
    setup_id smallint PRIMARY KEY CHECK (setup_id = 1),
    setup_complete boolean NOT NULL DEFAULT false
);

INSERT INTO admin_setup_state (setup_id, setup_complete)
VALUES (1, false)
ON CONFLICT (setup_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL UNIQUE DEFAULT ('PR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    source text NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'whatsapp', 'instagram', 'phone', 'store')),
    fulfillment_method text NOT NULL DEFAULT 'pickup' CHECK (fulfillment_method IN ('pickup', 'delivery')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled')),
    payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'partially_paid', 'paid', 'partially_refunded', 'refunded')),
    currency char(3) NOT NULL DEFAULT 'IQD' CHECK (currency ~ '^[A-Z]{3}$'),
    subtotal_minor bigint CHECK (subtotal_minor IS NULL OR subtotal_minor >= 0),
    discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
    delivery_minor bigint CHECK (delivery_minor IS NULL OR delivery_minor >= 0),
    total_minor bigint CHECK (total_minor IS NULL OR total_minor >= 0),
    customer_name_snapshot text,
    customer_phone_snapshot text,
    delivery_address_snapshot jsonb,
    customer_note text,
    staff_note text,
    privacy_consent_at timestamptz,
    privacy_notice_version text,
    placed_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CHECK (total_minor IS NULL OR subtotal_minor IS NOT NULL)
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment_method IN ('pickup', 'delivery'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('unpaid', 'pending', 'partially_paid', 'paid', 'partially_refunded', 'refunded'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS privacy_notice_version text;
ALTER TABLE orders ALTER COLUMN delivery_minor DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN delivery_minor DROP DEFAULT;

CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
    product_sku_snapshot text NOT NULL,
    product_name_snapshot text NOT NULL,
    color_name_snapshot text NOT NULL,
    size_label_snapshot text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price_minor bigint CHECK (unit_price_minor IS NULL OR unit_price_minor >= 0),
    line_total_minor bigint GENERATED ALWAYS AS (unit_price_minor * quantity) STORED,
    currency char(3) NOT NULL DEFAULT 'IQD' CHECK (currency ~ '^[A-Z]{3}$'),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_status_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    actor_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    previous_status text CHECK (previous_status IS NULL OR previous_status IN ('pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled')),
    new_status text NOT NULL CHECK (new_status IN ('pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled')),
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'staff', 'customer')),
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_status_events
    ADD COLUMN IF NOT EXISTS actor_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS email_notification_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status_event_id uuid NOT NULL UNIQUE REFERENCES order_status_events(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    recipient_email text NOT NULL,
    locale text NOT NULL CHECK (locale IN ('en', 'ckb')),
    notification_type text NOT NULL CHECK (notification_type IN ('order_received', 'order_status')),
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_notification_outbox
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed'));

CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    provider text NOT NULL,
    provider_reference text,
    idempotency_key text UNIQUE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'partial_refunded', 'refunded')),
    amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
    currency char(3) NOT NULL DEFAULT 'IQD' CHECK (currency ~ '^[A-Z]{3}$'),
    payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer')),
    refund_of_payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_reference)
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_of_payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'succeeded', 'failed', 'partial_refunded', 'refunded'));
CREATE INDEX IF NOT EXISTS payments_order_status_idx ON payments(order_id, status, created_at);
CREATE INDEX IF NOT EXISTS payments_refund_origin_idx ON payments(refund_of_payment_id) WHERE refund_of_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS accounting_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type text NOT NULL,
    payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer')),
    transfer_to text,
    direction text NOT NULL DEFAULT 'inflow',
    category text NOT NULL CHECK (length(trim(category)) BETWEEN 2 AND 80),
    description text NOT NULL CHECK (length(trim(description)) BETWEEN 2 AND 500),
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
    payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT,
    reversal_of_entry_id uuid REFERENCES accounting_entries(id) ON DELETE RESTRICT,
    recorded_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS transfer_to text;
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inflow';
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT;
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS reversal_of_entry_id uuid REFERENCES accounting_entries(id) ON DELETE RESTRICT;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_entry_type_check;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_transfer_to_check;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_check;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_check1;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_order_entry_check;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_transfer_check;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_direction_check;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_correction_check;
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_payment_link_check;
ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_entry_type_check
    CHECK (entry_type IN ('sale', 'manual_sale', 'expense', 'other_income', 'refund', 'opening_balance', 'transfer', 'correction'));
ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_order_entry_check
    CHECK (
        (entry_type IN ('sale', 'refund') AND order_id IS NOT NULL)
        OR (entry_type IN ('manual_sale', 'expense', 'other_income', 'opening_balance', 'transfer', 'correction') AND order_id IS NULL)
    );
ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_transfer_check
    CHECK (
        (entry_type = 'transfer' AND transfer_to IS NOT NULL AND transfer_to IN ('cash', 'bank_transfer') AND transfer_to <> payment_method)
        OR (entry_type = 'correction' AND (
            transfer_to IS NULL
            OR (transfer_to IN ('cash', 'bank_transfer') AND transfer_to <> payment_method)
        ))
        OR (entry_type NOT IN ('transfer', 'correction') AND transfer_to IS NULL)
    );
ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_direction_check
    CHECK (
        (entry_type IN ('sale', 'manual_sale', 'other_income', 'opening_balance') AND direction = 'inflow')
        OR (entry_type IN ('expense', 'refund') AND direction = 'outflow')
        OR (entry_type IN ('transfer', 'correction') AND direction IN ('inflow', 'outflow'))
    );
ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_correction_check
    CHECK (
        (entry_type = 'correction' AND reversal_of_entry_id IS NOT NULL)
        OR (entry_type <> 'correction' AND reversal_of_entry_id IS NULL)
    );
ALTER TABLE accounting_entries ADD CONSTRAINT accounting_entries_payment_link_check
    CHECK ((entry_type <> 'refund' OR payment_id IS NOT NULL) AND (entry_type IN ('sale', 'refund') OR payment_id IS NULL));
DROP INDEX IF EXISTS accounting_entries_one_sale_per_order_idx;
CREATE UNIQUE INDEX IF NOT EXISTS accounting_entries_payment_idx
    ON accounting_entries(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounting_entries_reversal_idx
    ON accounting_entries(reversal_of_entry_id) WHERE reversal_of_entry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounting_entries_opening_balance_idx
    ON accounting_entries(payment_method) WHERE entry_type = 'opening_balance';

CREATE TABLE IF NOT EXISTS inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    movement_type text NOT NULL CHECK (movement_type IN ('restock', 'sale', 'reservation', 'release', 'adjustment')),
    quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_code text NOT NULL UNIQUE,
    name text NOT NULL,
    address_en text NOT NULL,
    address_ckb text NOT NULL,
    city text NOT NULL,
    country_code char(2) NOT NULL DEFAULT 'IQ' CHECK (country_code ~ '^[A-Z]{2}$'),
    phone text,
    whatsapp_phone text,
    maps_url text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_hours (
    location_id uuid NOT NULL REFERENCES store_locations(id) ON DELETE CASCADE,
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    opens_at time,
    closes_at time,
    is_closed boolean NOT NULL DEFAULT false,
    PRIMARY KEY (location_id, day_of_week),
    CHECK (is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND closes_at > opens_at))
);

CREATE TABLE IF NOT EXISTS store_social_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES store_locations(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'youtube', 'website')),
    url text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    UNIQUE (location_id, platform)
);

CREATE TABLE IF NOT EXISTS api_rate_limit_windows (
    bucket_hash text PRIMARY KEY CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
    request_count integer NOT NULL CHECK (request_count > 0),
    reset_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS site_page_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path text NOT NULL CHECK (path LIKE '/%' AND length(path) <= 200),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_stage_status_idx ON products(stage_code, status);
CREATE INDEX IF NOT EXISTS product_translations_name_idx ON product_translations(locale, name);
CREATE INDEX IF NOT EXISTS product_images_product_order_idx ON product_images(product_id, image_role, sort_order);
CREATE INDEX IF NOT EXISTS variants_product_active_idx ON product_variants(product_id, is_active);
CREATE INDEX IF NOT EXISTS variants_color_size_idx ON product_variants(color_code, size_code);
CREATE INDEX IF NOT EXISTS variant_images_order_idx ON variant_images(variant_id, sort_order);
CREATE INDEX IF NOT EXISTS size_guide_stage_size_idx ON size_guide_entries(stage_code, size_code);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_sessions_user_expiry_idx ON admin_sessions(admin_user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_sessions_user_expiry_idx ON admin_sessions(admin_user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS orders_customer_placed_idx ON orders(customer_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_placed_idx ON orders(status, placed_at DESC);
CREATE INDEX IF NOT EXISTS orders_fulfillment_status_idx ON orders(fulfillment_method, status, placed_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS accounting_entries_occurred_idx ON accounting_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS accounting_entries_method_occurred_idx ON accounting_entries(payment_method, occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_notification_outbox_pending_idx ON email_notification_outbox(next_attempt_at, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS site_page_views_created_idx ON site_page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_variant_created_idx ON inventory_movements(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_rate_limit_windows_reset_idx ON api_rate_limit_windows(reset_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS variants_set_updated_at ON product_variants;
CREATE TRIGGER variants_set_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS locations_set_updated_at ON store_locations;
CREATE TRIGGER locations_set_updated_at BEFORE UPDATE ON store_locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();