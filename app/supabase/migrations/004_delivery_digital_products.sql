-- Mashpianim: Digital products, delivery flow, secure video access
-- Safe to run multiple times (IF NOT EXISTS / exception blocks).

-- ============================================================
-- NEW ENUMS
-- ============================================================

DO $$ BEGIN CREATE TYPE product_type AS ENUM ('physical', 'digital'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE digital_access_type AS ENUM ('link', 'code', 'invite', 'file'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE delivery_status AS ENUM ('pending', 'shipped', 'delivered', 'confirmed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend connection_status with 'delivered' if not present
DO $$
BEGIN
  ALTER TYPE connection_status ADD VALUE IF NOT EXISTS 'delivered' AFTER 'shipped';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PRODUCTS: add digital product fields
-- ============================================================

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type product_type NOT NULL DEFAULT 'physical';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_access_type digital_access_type;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_access_instructions text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_access_duration_days int;
EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- CONNECTIONS: add delivery tracking fields
-- ============================================================

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS delivery_type product_type;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS tracking_number text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS tracking_url text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS delivery_proof_url text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamptz;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS digital_access_value text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS digital_access_expires_at timestamptz;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS credit_deducted boolean NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS revision_count int NOT NULL DEFAULT 0;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE connections ADD COLUMN IF NOT EXISTS deliver_deadline timestamptz;
EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- VIDEOS: add access control fields
-- ============================================================

DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_downloadable boolean NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS download_count int NOT NULL DEFAULT 0;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS storage_path text;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS approved_at timestamptz;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id);
EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- OTP_CODES: missing from original migrations
-- ============================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS otp_codes_service_only ON otp_codes;
CREATE POLICY otp_codes_service_only ON otp_codes FOR ALL USING (false);

-- ============================================================
-- ACTIVITY_LOG: audit trail for admin
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_log_admin ON activity_log;
CREATE POLICY activity_log_admin ON activity_log FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS activity_log_insert ON activity_log;
CREATE POLICY activity_log_insert ON activity_log FOR INSERT WITH CHECK (true);

-- ============================================================
-- NOTIFICATION HELPER: allow service role to insert notifications
-- ============================================================

DROP POLICY IF EXISTS notifications_service_insert ON notifications;
CREATE POLICY notifications_service_insert ON notifications FOR INSERT WITH CHECK (true);

-- ============================================================
-- NEW INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_connections_delivery_type ON connections(delivery_type);
CREATE INDEX IF NOT EXISTS idx_connections_credit_deducted ON connections(credit_deducted);
CREATE INDEX IF NOT EXISTS idx_connections_deliver_deadline ON connections(deliver_deadline);
CREATE INDEX IF NOT EXISTS idx_videos_is_downloadable ON videos(is_downloadable);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
