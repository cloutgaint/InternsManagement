-- Extend existing report asset ownership rules without changing stamp/mentor semantics.
ALTER TABLE report_brand_assets DROP CONSTRAINT IF EXISTS report_brand_assets_check;
ALTER TABLE report_brand_assets ADD CONSTRAINT report_brand_assets_check CHECK (
  (asset_key='company_stamp' AND owner_user_id IS NULL)
  OR (asset_key='mentor_signature' AND owner_user_id IS NOT NULL)
  OR (asset_key='offer_letterhead' AND owner_user_id IS NULL)
  OR (asset_key='offer_signature' AND owner_user_id IS NULL)
);
