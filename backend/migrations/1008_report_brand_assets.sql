CREATE TABLE IF NOT EXISTS report_brand_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 asset_key text NOT NULL,
 owner_user_id uuid REFERENCES users(id),
 mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg')),
 image_data bytea NOT NULL,
 updated_by uuid REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((asset_key='company_stamp' AND owner_user_id IS NULL) OR (asset_key='mentor_signature' AND owner_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_company ON report_brand_assets(asset_key) WHERE asset_key='company_stamp';
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_brand_owner ON report_brand_assets(owner_user_id) WHERE asset_key='mentor_signature';
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS finalized_mentor_id uuid REFERENCES users(id);
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS stamp_snapshot bytea;
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS stamp_mime text;
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS signature_snapshot bytea;
ALTER TABLE klu_fortnight_reports ADD COLUMN IF NOT EXISTS signature_mime text;