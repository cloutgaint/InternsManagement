CREATE TABLE IF NOT EXISTS report_brand_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 asset_key text NOT NULL,
 owner_user_id uuid REFERENCES users(id),
 mime_type text NOT NULL CHECK(
  (asset_key IN ('company_stamp','mentor_signature','offer_signature','offer_watermark') AND mime_type IN ('image/png','image/jpeg')) OR
  (asset_key='offer_letterhead' AND mime_type IN ('image/png','image/jpeg','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
 ),
 image_data bytea NOT NULL,
 updated_by uuid REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (
  (asset_key IN ('company_stamp','offer_letterhead','offer_signature','offer_watermark') AND owner_user_id IS NULL) OR
  (asset_key='mentor_signature' AND owner_user_id IS NOT NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_company ON report_brand_assets(asset_key) WHERE asset_key='company_stamp';
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_owner ON report_brand_assets(owner_user_id) WHERE asset_key='mentor_signature';
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_offer_letterhead ON report_brand_assets(asset_key) WHERE asset_key='offer_letterhead';
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_offer_signature ON report_brand_assets(asset_key) WHERE asset_key='offer_signature';
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_offer_watermark ON report_brand_assets(asset_key) WHERE asset_key='offer_watermark';
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS finalized_mentor_id uuid REFERENCES users(id);
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS stamp_snapshot bytea;
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS stamp_mime text;
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS signature_snapshot bytea;
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS signature_mime text;
