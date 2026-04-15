ALTER TABLE store_profiles ADD COLUMN IF NOT EXISTS delivery_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE store_profiles ADD COLUMN IF NOT EXISTS pix_key TEXT;
