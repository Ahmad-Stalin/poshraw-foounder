WITH catalog_images(sku, image_name, alt_en, alt_ckb) AS (
  VALUES
    ('POSH-KG-001', 'IMG_8438.webp', 'School uniform set', 'کۆمەڵەی یۆنیفۆرمی قوتابخانە'),
    ('POSH-KG-002', 'IMG_8437.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-KG-003', 'IMG_8440.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-PR-001', 'IMG_8441.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-PR-002', 'IMG_8442.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-PR-003', 'IMG_8443.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-MD-001', 'IMG_8444.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-MD-002', 'IMG_8445.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-MD-003', 'IMG_8446.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-HS-001', 'IMG_8447.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-HS-002', 'IMG_8448.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە'),
    ('POSH-HS-003', 'IMG_8449.webp', 'School uniform', 'یۆنیفۆرمی قوتابخانە')
)
UPDATE product_images AS image
SET image_url = '/images/poshraw/' || catalog.image_name,
    alt_text = catalog.alt_en || ' / ' || catalog.alt_ckb
FROM products AS product
JOIN catalog_images AS catalog ON catalog.sku = product.sku
WHERE image.product_id = product.id
  AND image.image_role = 'card'
  AND image.sort_order = 1
  AND image.image_url LIKE 'https://images.unsplash.com/%';

DELETE FROM variant_images
WHERE image_url IN (
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=85'
);

INSERT INTO variant_images (variant_id, image_url, alt_text, view_label, sort_order)
SELECT variant.id,
       image.image_url,
       product.sku || ' school uniform',
       'front',
       1
FROM product_variants AS variant
JOIN products AS product ON product.id = variant.product_id
JOIN product_images AS image
  ON image.product_id = product.id
 AND image.image_role = 'card'
 AND image.sort_order = 1
WHERE variant.size_code = 'M'
ON CONFLICT (variant_id, sort_order) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  alt_text = EXCLUDED.alt_text,
  view_label = EXCLUDED.view_label;

INSERT INTO variant_images (variant_id, image_url, alt_text, view_label, sort_order)
SELECT variant.id,
       '/images/poshraw/IMG_8439.webp',
       'POSHRAW.Co school uniform detail',
       'detail',
       2
FROM product_variants AS variant
JOIN products AS product ON product.id = variant.product_id
WHERE product.sku = 'POSH-KG-001'
  AND variant.size_code = 'M'
ON CONFLICT (variant_id, sort_order) DO NOTHING;
