-- Extend existing report asset rules without changing stamp/mentor semantics.
ALTER TABLE report_brand_assets
 DROP CONSTRAINT IF EXISTS report_brand_assets_mime_type_check,
 DROP CONSTRAINT IF EXISTS report_brand_assets_check;

ALTER TABLE report_brand_assets
 ADD CONSTRAINT report_brand_assets_mime_type_check CHECK (
  (asset_key IN ('company_stamp','mentor_signature','offer_signature','offer_watermark') AND mime_type IN ('image/png','image/jpeg')) OR
  (asset_key='offer_letterhead' AND mime_type IN ('image/png','image/jpeg','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
 ),
 ADD CONSTRAINT report_brand_assets_check CHECK (
  (asset_key IN ('company_stamp','offer_letterhead','offer_signature','offer_watermark') AND owner_user_id IS NULL) OR
  (asset_key='mentor_signature' AND owner_user_id IS NOT NULL)
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_offer_signature
 ON report_brand_assets(asset_key)
 WHERE asset_key='offer_signature';

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_offer_watermark
 ON report_brand_assets(asset_key)
 WHERE asset_key='offer_watermark';
