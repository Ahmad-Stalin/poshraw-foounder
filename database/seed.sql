INSERT INTO school_stages (code, sort_order, name_en, name_ckb)
VALUES
    ('kindergarten', 1, 'Kindergarten', 'باخچە'),
    ('primary', 2, 'Primary school', 'سەرەتایی'),
    ('middle', 3, 'Middle school', 'ناوەندی'),
    ('high', 4, 'High school', 'ئامادەیی')
ON CONFLICT (code) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    name_en = EXCLUDED.name_en,
    name_ckb = EXCLUDED.name_ckb;

INSERT INTO color_options (code, name_en, name_ckb, hex_value, sort_order)
VALUES
    ('NAVY', 'Navy', 'شینی تۆخ', '#182948', 1),
    ('WHITE', 'White', 'سپی', '#F6F5F1', 2),
    ('GREY', 'Grey', 'خۆڵەمێشی', '#89909B', 3),
    ('MAROON', 'Maroon', 'مارۆنی', '#793C4D', 4)
ON CONFLICT (code) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ckb = EXCLUDED.name_ckb,
    hex_value = EXCLUDED.hex_value,
    sort_order = EXCLUDED.sort_order;

INSERT INTO sizes (code, label, sort_order)
VALUES
    ('XS', 'XS', 1),
    ('S', 'S', 2),
    ('M', 'M', 3),
    ('L', 'L', 4),
    ('XL', 'XL', 5)
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

INSERT INTO size_guide_entries (stage_code, size_code, age_min_months, age_max_months, height_min_cm, height_max_cm, chest_cm, waist_cm, hip_cm, fit_note_en, fit_note_ckb)
VALUES
    ('kindergarten', 'XS', 36, 48, 92, 98, 52, 48, 53, 'Relaxed fit with extra room for a comfortable school-day shape.', 'کێشێکی سادە و گونجاو بۆ هەموو ڕۆژێکی قوتابخانە.'),
    ('kindergarten', 'S', 48, 60, 98, 104, 54, 51, 55, 'Still roomy for movement and easy layering.', 'هێندێک زۆرتر بۆ جێژوان و پەردەبەندی ئاسان.'),
    ('kindergarten', 'M', 60, 72, 104, 110, 57, 54, 58, 'Balanced fit for daily wear and active play.', 'گونجاو بۆ ڕۆژانە و یاریی هەڵواسراو.'),
    ('kindergarten', 'L', 72, 84, 110, 116, 59, 56, 60, 'A little more room for growth during the school term.', 'بێژمارەکەی زۆرتر بۆ گەشەکردن لەناو ساڵدا.'),
    ('kindergarten', 'XL', 84, 96, 116, 122, 61, 58, 62, 'Generous fit that keeps the uniform comfortable as they grow.', 'گونجاو و بێژه‌ڵەوە بۆ هەموو پیوەی گەشەکردن.'),
    ('primary', 'XS', 72, 84, 112, 118, 56, 52, 58, 'A clean, easy fit for early primary years.', 'کێشێکی سادە بۆ ساڵانی سەرەتایی.'),
    ('primary', 'S', 84, 96, 118, 124, 58, 54, 60, 'Classic cut with enough room for movement and growth.', 'کێشێکی کلاسیکی گونجاو بۆ هەموو جێژوانی قوتابخانە.'),
    ('primary', 'M', 96, 108, 124, 130, 60, 56, 63, 'Balanced for everyday comfort and polished wear.', 'گونجاو بۆ ئاسوودەی ڕۆژانە و ستایلێکی ڕێک.'),
    ('primary', 'L', 108, 120, 130, 136, 63, 58, 66, 'Comfortable fit for a school schedule that stays busy.', 'کێشێکی ئاسوودە بۆ خوێندنی پڕکار.'),
    ('primary', 'XL', 120, 132, 136, 142, 66, 60, 69, 'Roomy enough for active days while keeping a smart shape.', 'زۆر هەست بە هەمووڕۆژانە و شێوازی ڕێک.'),
    ('middle', 'XS', 120, 132, 138, 144, 62, 58, 66, 'Smart fit with a slightly tailored line.', 'کێشێکی ڕێکخراو و نوێ.'),
    ('middle', 'S', 132, 144, 144, 150, 65, 60, 69, 'A fitted look without feeling restrictive.', 'کێشێکی گونجاو بێ‌کەڵەکەڵی زۆر.'),
    ('middle', 'M', 144, 156, 150, 156, 68, 62, 72, 'The standard middle-school fit for daily uniform wear.', 'کێشێکی ناوەندی بۆ ڕۆژانەی قوتابخانە.'),
    ('middle', 'L', 156, 168, 156, 162, 72, 65, 75, 'Room to move while keeping the shape crisp.', 'بۆ جێژوان و دووچاری ستایلێکی ڕێک.'),
    ('middle', 'XL', 168, 180, 162, 168, 76, 68, 79, 'A little more space for growth and a confident length.', 'هێندێک زۆرتر بۆ گەشەکردن و درێژیی ڕێکخراو.'),
    ('high', 'XS', 144, 156, 154, 160, 66, 60, 70, 'A polished fit that still leaves comfortable movement.', 'کێشێکی وەک یۆنیفۆرمی ڕێک و ئاسوودە.'),
    ('high', 'S', 156, 168, 160, 166, 70, 63, 73, 'The standard fit for a mature uniform shape.', 'کێشێکی یەکگرتوو و ڕێک بۆ یۆنیفۆرم.'),
    ('high', 'M', 168, 180, 166, 172, 74, 66, 77, 'Balanced and refined for senior school wear.', 'گۆڕانکارییەکی باش بۆ قوتابخانەی قۆناغی ئامادەیی.'),
    ('high', 'L', 180, 192, 172, 178, 78, 69, 81, 'Comfortable enough for long days with a neat finish.', 'ئاسوودە بۆ ڕۆژانی درێژ و ستایلێکی ڕێک.'),
    ('high', 'XL', 192, 204, 178, 184, 82, 72, 85, 'A confident fit designed for a longer school term and posture.', 'کێشێکی باوەڕپێکراو بۆ هەموو ڕۆژانی خوێندن.' )
ON CONFLICT (stage_code, size_code) DO UPDATE SET
    age_min_months = EXCLUDED.age_min_months,
    age_max_months = EXCLUDED.age_max_months,
    height_min_cm = EXCLUDED.height_min_cm,
    height_max_cm = EXCLUDED.height_max_cm,
    chest_cm = EXCLUDED.chest_cm,
    waist_cm = EXCLUDED.waist_cm,
    hip_cm = EXCLUDED.hip_cm,
    fit_note_en = EXCLUDED.fit_note_en,
    fit_note_ckb = EXCLUDED.fit_note_ckb;

WITH catalog(sku, slug, stage_code) AS (
    VALUES
        ('POSH-KG-001', 'polo-trouser-set', 'kindergarten'),
        ('POSH-KG-002', 'kindergarten-pinafore', 'kindergarten'),
        ('POSH-KG-003', 'school-day-cardigan', 'kindergarten'),
        ('POSH-PR-001', 'everyday-school-shirt', 'primary'),
        ('POSH-PR-002', 'pleated-uniform-skirt', 'primary'),
        ('POSH-PR-003', 'everyday-uniform-trousers', 'primary'),
        ('POSH-MD-001', 'classic-school-blazer', 'middle'),
        ('POSH-MD-002', 'shirt-and-tie-set', 'middle'),
        ('POSH-MD-003', 'button-front-cardigan', 'middle'),
        ('POSH-HS-001', 'senior-uniform-set', 'high'),
        ('POSH-HS-002', 'blazer-and-trousers', 'high'),
        ('POSH-HS-003', 'senior-pleated-skirt', 'high')
)
INSERT INTO products (sku, slug, stage_code, status, currency)
SELECT sku, slug, stage_code, 'active', 'IQD'
FROM catalog
ON CONFLICT (sku) DO UPDATE SET
    slug = EXCLUDED.slug,
    stage_code = EXCLUDED.stage_code,
    status = EXCLUDED.status;

WITH translations(sku, locale, name, short_description, description) AS (
    VALUES
        ('POSH-KG-001', 'en', 'Polo & trouser set', 'Easy everyday uniform for little learners.', 'An easy everyday uniform for busy little school days.'),
        ('POSH-KG-001', 'ckb', 'پۆلۆ و پانتۆڵی باخچە', 'یۆنیفۆرمی ئاسان بۆ قوتابیی بچووک.', 'ستایلێکی سادە و ئاسوودە بۆ یاری و خوێندنی ڕۆژانە.'),
        ('POSH-KG-002', 'en', 'Kindergarten pinafore', 'A classic pinafore for school.', 'A classic pinafore made to pair with a school shirt.'),
        ('POSH-KG-002', 'ckb', 'کراسەی باخچە', 'کراسێکی کلاسیکی قوتابخانە.', 'کراسێکی کلاسیکی کە بە ئاسانی لەگەڵ کراسی قوتابخانە دەگونجێت.'),
        ('POSH-KG-003', 'en', 'School-day cardigan', 'An extra layer for cooler days.', 'An extra layer for cool mornings and classroom breaks.'),
        ('POSH-KG-003', 'ckb', 'کاردیگانی باخچە', 'جلێکی زیادە بۆ ڕۆژە ساردەکان.', 'جلێکی زیادە بۆ بەیانی و پشووی نێوان وانەکان.'),
        ('POSH-PR-001', 'en', 'Everyday school shirt', 'A clean, classic uniform shirt.', 'A clean, classic shirt for a polished school-day look.'),
        ('POSH-PR-001', 'ckb', 'کراسی سەرەتایی', 'کراسی کلاسیکی قوتابخانە.', 'کراسی پاک و ڕێک بۆ تەواوکردنی ستایلی قوتابخانە.'),
        ('POSH-PR-002', 'en', 'Pleated uniform skirt', 'A timeless pleated silhouette.', 'A timeless pleated silhouette that pairs with uniform staples.'),
        ('POSH-PR-002', 'ckb', 'تەنوورەی چین‌چین', 'تەنوورەیەکی کلاسیک بۆ یۆنیفۆرمی قوتابخانە.', 'تەنوورەیەکی کلاسیک کە بە ئاسانی لەگەڵ جلوبەرگی قوتابخانە دەگونجێت.'),
        ('POSH-PR-003', 'en', 'Everyday uniform trousers', 'Neat trousers for active school days.', 'A neat everyday trouser for active school days.'),
        ('POSH-PR-003', 'ckb', 'پانتۆڵی قوتابخانە', 'پانتۆڵێکی ڕێک بۆ ڕۆژانی قوتابخانە.', 'پانتۆڵێکی ڕێکخراو بۆ ڕۆژانی پڕجووڵەی قوتابخانە.'),
        ('POSH-MD-001', 'en', 'Classic school blazer', 'A polished layer for school.', 'A classic blazer for a more considered uniform look.'),
        ('POSH-MD-001', 'ckb', 'چاڵەکی ناوەندی', 'چاڵەکێکی ڕێکخراوی قوتابخانە.', 'چاڵەکێکی کلاسیک بۆ ستایلێکی ڕێکخراوی قوتابخانە.'),
        ('POSH-MD-002', 'en', 'Shirt & tie set', 'A coordinated formal uniform set.', 'A coordinated shirt and tie for formal school days.'),
        ('POSH-MD-002', 'ckb', 'کراس و گەردەن‌بەندی', 'کۆمەڵەیەکی فەرمی و یەکگرتوو.', 'کۆمەڵەی کراس و گەردەن‌بەندی بۆ ستایلی فەرمیتر.'),
        ('POSH-MD-003', 'en', 'Button-front cardigan', 'A versatile school layer.', 'A versatile layer for changing classroom temperatures.'),
        ('POSH-MD-003', 'ckb', 'کاردیگانی قوتابخانە', 'چینێکی گونجاو بۆ قوتابخانە.', 'چینێکی گونجاو بۆ کاتی گۆڕانی کەشوهەوا.'),
        ('POSH-HS-001', 'en', 'Senior uniform set', 'A refined set for senior students.', 'A refined uniform set for the senior school years.'),
        ('POSH-HS-001', 'ckb', 'کۆمەڵەی ئامادەیی', 'کۆمەڵەیەکی کلاسیک بۆ ئامادەیی.', 'ستایلی کلاسیک بۆ ساڵانی کۆتایی قوتابخانە.'),
        ('POSH-HS-002', 'en', 'Blazer & trousers', 'Two classic uniform essentials.', 'Two classic pieces designed to make one considered uniform.'),
        ('POSH-HS-002', 'ckb', 'چاڵەک و پانتۆڵ', 'دوو پارچەی کلاسیکی یۆنیفۆرم.', 'دوو پارچەی کلاسیک کە بە یەکەوە ستایلێکی یەکگرتوو دروست دەکەن.'),
        ('POSH-HS-003', 'en', 'Senior pleated skirt', 'A polished preparatory-school skirt.', 'A simple, polished skirt for preparatory school.'),
        ('POSH-HS-003', 'ckb', 'تەنوورەی ئامادەیی', 'تەنوورەیەکی ڕێک بۆ قۆناغی ئامادەیی.', 'تەنوورەیەکی سادە و ڕێک بۆ قۆناغی ئامادەیی.')
)
INSERT INTO product_translations (product_id, locale, name, short_description, description)
SELECT p.id, t.locale, t.name, t.short_description, t.description
FROM translations t
JOIN products p ON p.sku = t.sku
ON CONFLICT (product_id, locale) DO UPDATE SET
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description;

WITH catalog_images(sku, image_id, alt_en, alt_ckb) AS (
    VALUES
        ('POSH-KG-001', 'photo-1600792175842-4fa8ae4b36ba', 'Children in school uniform', 'منداڵانی قوتابخانە بە یۆنیفۆرم'),
        ('POSH-KG-002', 'photo-1759143101324-d375443f1955', 'Schoolchildren in a classroom', 'قوتابییان لە پۆل'),
        ('POSH-KG-003', 'photo-1612229693210-30e16029c415', 'Children wearing school uniform', 'منداڵان بە یۆنیفۆرمی قوتابخانە'),
        ('POSH-PR-001', 'photo-1569173675610-42c361a86e37', 'Students in blue school uniforms', 'قوتابییان بە یۆنیفۆرمی شین'),
        ('POSH-PR-002', 'photo-1753175843003-a7492d611bf9', 'School uniform collection', 'کۆڵێکشنی یۆنیفۆرمی قوتابخانە'),
        ('POSH-PR-003', 'photo-1642140027867-e5983a32119c', 'Boys wearing blue shirts and ties', 'کوڕان بە کراس و گەردەن‌بەندی'),
        ('POSH-MD-001', 'photo-1612229693210-30e16029c415', 'Children wearing school uniform', 'منداڵان بە یۆنیفۆرمی قوتابخانە'),
        ('POSH-MD-002', 'photo-1642140027867-e5983a32119c', 'Boys wearing blue shirts and ties', 'کوڕان بە کراس و گەردەن‌بەندی'),
        ('POSH-MD-003', 'photo-1759143101324-d375443f1955', 'Schoolchildren in a classroom', 'قوتابییان لە پۆل'),
        ('POSH-HS-001', 'photo-1753175843003-a7492d611bf9', 'Students in uniform together', 'قوتابییان بە یۆنیفۆرم'),
        ('POSH-HS-002', 'photo-1569173675610-42c361a86e37', 'Students in blue school uniforms', 'قوتابییان بە یۆنیفۆرمی شین'),
        ('POSH-HS-003', 'photo-1759143101324-d375443f1955', 'Schoolchildren in a classroom', 'قوتابییان لە پۆل')
)
INSERT INTO product_images (product_id, image_url, alt_text, image_role, sort_order)
SELECT p.id,
       'https://images.unsplash.com/' || i.image_id || '?auto=format&fit=crop&w=1200&q=85',
       i.alt_en || ' / ' || i.alt_ckb,
       'card',
       1
FROM catalog_images i
JOIN products p ON p.sku = i.sku
ON CONFLICT (product_id, image_role, sort_order) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    alt_text = EXCLUDED.alt_text;

INSERT INTO product_variants (
    product_id,
    color_code,
    size_code,
    variant_sku,
    price_minor,
    currency,
    track_inventory,
    stock_on_hand
)
SELECT p.id,
       c.code,
       s.code,
       p.sku || '-' || c.code || '-' || s.code,
       p.price_minor,
       p.currency,
       false,
       NULL
FROM products p
CROSS JOIN color_options c
CROSS JOIN sizes s
WHERE p.sku LIKE 'POSH-%'
ON CONFLICT (product_id, color_code, size_code) DO NOTHING;

INSERT INTO variant_images (variant_id, image_url, alt_text, view_label, sort_order)
SELECT v.id,
       'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
       p.sku || ' ' || c.name_en || ' front view',
       'front',
       1
FROM product_variants v
JOIN products p ON p.id = v.product_id
JOIN color_options c ON c.code = v.color_code
WHERE v.size_code = 'M'
ON CONFLICT (variant_id, sort_order) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    alt_text = EXCLUDED.alt_text,
    view_label = EXCLUDED.view_label;

INSERT INTO variant_images (variant_id, image_url, alt_text, view_label, sort_order)
SELECT v.id,
       'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=85',
       p.sku || ' ' || c.name_en || ' back view',
       'back',
       2
FROM product_variants v
JOIN products p ON p.id = v.product_id
JOIN color_options c ON c.code = v.color_code
WHERE v.size_code = 'M'
ON CONFLICT (variant_id, sort_order) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    alt_text = EXCLUDED.alt_text,
    view_label = EXCLUDED.view_label;

INSERT INTO variant_images (variant_id, image_url, alt_text, view_label, sort_order)
SELECT v.id,
       'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=85',
       p.sku || ' ' || c.name_en || ' detail view',
       'detail',
       3
FROM product_variants v
JOIN products p ON p.id = v.product_id
JOIN color_options c ON c.code = v.color_code
WHERE v.size_code = 'M'
ON CONFLICT (variant_id, sort_order) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    alt_text = EXCLUDED.alt_text,
    view_label = EXCLUDED.view_label;

INSERT INTO store_locations (
    location_code,
    name,
    address_en,
    address_ckb,
    city,
    maps_url
)
VALUES (
    'SUL-KHALA-HAJI',
    'POSHRAW.Co Sulaymaniyah',
    'Below Khala Haji circle, beside Hawal Home Furniture',
    'خوار فلکەی خاڵە حاجی، تەنیشت مۆبیلیاتی هەواڵ هۆم',
    'Sulaymaniyah',
    'https://www.google.com/maps/search/?api=1&query=Khwar+Flkay+Khala+Haji+next+to+Hawal+Home+Furniture+Sulaymaniyah'
)
ON CONFLICT (location_code) DO UPDATE SET
    name = EXCLUDED.name,
    address_en = EXCLUDED.address_en,
    address_ckb = EXCLUDED.address_ckb,
    city = EXCLUDED.city,
    maps_url = EXCLUDED.maps_url;

INSERT INTO store_social_links (location_id, platform, url)
SELECT id, 'instagram', 'https://www.instagram.com/poshraw.co/'
FROM store_locations
WHERE location_code = 'SUL-KHALA-HAJI'
ON CONFLICT (location_id, platform) DO UPDATE SET url = EXCLUDED.url;