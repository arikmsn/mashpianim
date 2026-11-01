-- Mashpianim: Safe/Idempotent Schema Migration
-- Run this instead of 001 when some objects already exist.

-- ============================================================
-- ENUMS (safe: DO NOTHING if exists)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_type AS ENUM ('creator', 'brand', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM (
    'pending', 'approved', 'rejected', 'shipped', 'filming',
    'uploaded', 'in_review', 'revision_requested', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE video_status AS ENUM ('pending', 'approved', 'revision_requested');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE creator_level AS ENUM ('creator', 'creator_plus', 'on_the_radar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('active', 'paused', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shipping_policy AS ENUM ('free', 'paid', 'pickup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLES (IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type user_type NOT NULL,
  email text,
  phone text NOT NULL,
  avatar_url text,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false,
  auth_user_id uuid REFERENCES auth.users(id),
  UNIQUE (phone, type)
);

CREATE TABLE IF NOT EXISTS creator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  bio text,
  tiktok_handle text,
  tiktok_followers int NOT NULL DEFAULT 0,
  instagram_handle text,
  instagram_followers int NOT NULL DEFAULT 0,
  categories text[] NOT NULL DEFAULT '{}',
  level creator_level NOT NULL DEFAULT 'creator',
  hearts int NOT NULL DEFAULT 0,
  completed_connections int NOT NULL DEFAULT 0,
  intro_video_url text,
  city text,
  date_of_birth date
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  shop_name text NOT NULL,
  logo_url text,
  category text,
  website_url text,
  description text,
  total_credits int NOT NULL DEFAULT 0,
  used_credits int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  price numeric(10,2) NOT NULL,
  description text,
  shipping_policy shipping_policy NOT NULL DEFAULT 'free',
  shipping_address text,
  status product_status NOT NULL DEFAULT 'active',
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status connection_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  shipped_at timestamptz,
  filmed_at timestamptz,
  completed_at timestamptz,
  ship_deadline timestamptz,
  film_deadline timestamptz,
  review_deadline timestamptz,
  rejection_reason text,
  revision_notes text
);

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumbnail_url text,
  duration_seconds int,
  status video_status NOT NULL DEFAULT 'pending',
  revision_notes text,
  moderation_flags text[] NOT NULL DEFAULT '{}',
  ai_review_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  total int NOT NULL,
  used int NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  package_name text NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  credits int NOT NULL,
  payment_method text NOT NULL,
  payment_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_brand_id uuid NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  referred_brand_id uuid REFERENCES brand_profiles(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  credits_awarded int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_content (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS site_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- ============================================================
-- INDEXES (IF NOT EXISTS)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id ON creator_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_level ON creator_profiles(level);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id ON brand_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE INDEX IF NOT EXISTS idx_connections_creator_id ON connections(creator_id);
CREATE INDEX IF NOT EXISTS idx_connections_brand_id ON connections(brand_id);
CREATE INDEX IF NOT EXISTS idx_connections_product_id ON connections(product_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

CREATE INDEX IF NOT EXISTS idx_videos_connection_id ON videos(connection_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

CREATE INDEX IF NOT EXISTS idx_messages_connection_id ON messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(connection_id, created_at);

CREATE INDEX IF NOT EXISTS idx_credits_brand_id ON credits(brand_id);

CREATE INDEX IF NOT EXISTS idx_transactions_brand_id ON transactions(brand_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_brand_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);

-- ============================================================
-- TRIGGERS & FUNCTIONS (CREATE OR REPLACE = safe)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS site_content_updated_at ON site_content;
CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS site_settings_updated_at ON site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- HELPER FUNCTIONS (CREATE OR REPLACE = safe)
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS uuid AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_user_type()
RETURNS user_type AS $$
  SELECT type FROM users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND type = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_creator_profile_id()
RETURNS uuid AS $$
  SELECT cp.id FROM creator_profiles cp
  JOIN users u ON u.id = cp.user_id
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_brand_profile_id()
RETURNS uuid AS $$
  SELECT bp.id FROM brand_profiles bp
  JOIN users u ON u.id = bp.user_id
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- RLS POLICIES (DROP IF EXISTS + CREATE = safe)
-- ============================================================

-- ---- users ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users FOR SELECT USING (auth_user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (true);

-- ---- creator_profiles ----
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creator_profiles_select ON creator_profiles;
CREATE POLICY creator_profiles_select ON creator_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS creator_profiles_update_own ON creator_profiles;
CREATE POLICY creator_profiles_update_own ON creator_profiles FOR UPDATE USING (user_id = get_my_user_id()) WITH CHECK (user_id = get_my_user_id());
DROP POLICY IF EXISTS creator_profiles_insert ON creator_profiles;
CREATE POLICY creator_profiles_insert ON creator_profiles FOR INSERT WITH CHECK (user_id = get_my_user_id() OR is_admin());

-- ---- brand_profiles ----
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_profiles_select ON brand_profiles;
CREATE POLICY brand_profiles_select ON brand_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS brand_profiles_update_own ON brand_profiles;
CREATE POLICY brand_profiles_update_own ON brand_profiles FOR UPDATE USING (user_id = get_my_user_id()) WITH CHECK (user_id = get_my_user_id());
DROP POLICY IF EXISTS brand_profiles_insert ON brand_profiles;
CREATE POLICY brand_profiles_insert ON brand_profiles FOR INSERT WITH CHECK (user_id = get_my_user_id() OR is_admin());

-- ---- products ----
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_select ON products;
CREATE POLICY products_select ON products FOR SELECT USING (status = 'active' OR brand_id = get_my_brand_profile_id() OR is_admin());
DROP POLICY IF EXISTS products_insert ON products;
CREATE POLICY products_insert ON products FOR INSERT WITH CHECK (brand_id = get_my_brand_profile_id() OR is_admin());
DROP POLICY IF EXISTS products_update ON products;
CREATE POLICY products_update ON products FOR UPDATE USING (brand_id = get_my_brand_profile_id() OR is_admin()) WITH CHECK (brand_id = get_my_brand_profile_id() OR is_admin());
DROP POLICY IF EXISTS products_delete ON products;
CREATE POLICY products_delete ON products FOR DELETE USING (brand_id = get_my_brand_profile_id() OR is_admin());

-- ---- connections ----
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connections_select ON connections;
CREATE POLICY connections_select ON connections FOR SELECT USING (creator_id = get_my_creator_profile_id() OR brand_id = get_my_brand_profile_id() OR is_admin());
DROP POLICY IF EXISTS connections_insert ON connections;
CREATE POLICY connections_insert ON connections FOR INSERT WITH CHECK (creator_id = get_my_creator_profile_id() OR is_admin());
DROP POLICY IF EXISTS connections_update ON connections;
CREATE POLICY connections_update ON connections FOR UPDATE USING (creator_id = get_my_creator_profile_id() OR brand_id = get_my_brand_profile_id() OR is_admin());

-- ---- videos ----
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS videos_select ON videos;
CREATE POLICY videos_select ON videos FOR SELECT USING (
  EXISTS (SELECT 1 FROM connections c WHERE c.id = videos.connection_id AND (c.creator_id = get_my_creator_profile_id() OR c.brand_id = get_my_brand_profile_id()))
  OR is_admin()
);
DROP POLICY IF EXISTS videos_insert ON videos;
CREATE POLICY videos_insert ON videos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM connections c WHERE c.id = connection_id AND c.creator_id = get_my_creator_profile_id())
  OR is_admin()
);
DROP POLICY IF EXISTS videos_update ON videos;
CREATE POLICY videos_update ON videos FOR UPDATE USING (is_admin());

-- ---- messages ----
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM connections c WHERE c.id = messages.connection_id AND (c.creator_id = get_my_creator_profile_id() OR c.brand_id = get_my_brand_profile_id()))
  OR is_admin()
);
DROP POLICY IF EXISTS messages_insert ON messages;
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  sender_id = get_my_user_id()
  AND EXISTS (SELECT 1 FROM connections c WHERE c.id = connection_id AND (c.creator_id = get_my_creator_profile_id() OR c.brand_id = get_my_brand_profile_id()))
);

-- ---- credits ----
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credits_select ON credits;
CREATE POLICY credits_select ON credits FOR SELECT USING (brand_id = get_my_brand_profile_id() OR is_admin());
DROP POLICY IF EXISTS credits_insert ON credits;
CREATE POLICY credits_insert ON credits FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS credits_update ON credits;
CREATE POLICY credits_update ON credits FOR UPDATE USING (is_admin());

-- ---- transactions ----
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactions_select ON transactions;
CREATE POLICY transactions_select ON transactions FOR SELECT USING (brand_id = get_my_brand_profile_id() OR is_admin());
DROP POLICY IF EXISTS transactions_insert ON transactions;
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (is_admin());

-- ---- notifications ----
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT USING (user_id = get_my_user_id());
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = get_my_user_id()) WITH CHECK (user_id = get_my_user_id());
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (is_admin());

-- ---- referrals ----
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referrals_select ON referrals;
CREATE POLICY referrals_select ON referrals FOR SELECT USING (referrer_brand_id = get_my_brand_profile_id() OR is_admin());
DROP POLICY IF EXISTS referrals_insert ON referrals;
CREATE POLICY referrals_insert ON referrals FOR INSERT WITH CHECK (is_admin());

-- ---- site_content ----
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_content_select ON site_content;
CREATE POLICY site_content_select ON site_content FOR SELECT USING (true);
DROP POLICY IF EXISTS site_content_update ON site_content;
CREATE POLICY site_content_update ON site_content FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS site_content_insert ON site_content;
CREATE POLICY site_content_insert ON site_content FOR INSERT WITH CHECK (is_admin());

-- ---- site_settings ----
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_settings_select ON site_settings;
CREATE POLICY site_settings_select ON site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS site_settings_update ON site_settings;
CREATE POLICY site_settings_update ON site_settings FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS site_settings_insert ON site_settings;
CREATE POLICY site_settings_insert ON site_settings FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- REALTIME (safe: ignore if already added)
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SEED DATA (ON CONFLICT = safe upsert)
-- ============================================================

INSERT INTO site_content (id, data) VALUES
('hero', '{"badge": "הפלטפורמה ליוצרי תוכן ומותגים בישראל", "title_line1": "יוצרים תוכן.", "title_line2": "מחברים מותגים.", "subtitle": "קבלו מוצרים חינם, צלמו סרטונים אותנטיים, וצמחו כיוצרי תוכן. עסקים — קבלו תוכן UGC איכותי במחיר שפוי.", "cta_creator": "אני יוצר/ת תוכן", "cta_brand": "אני בעל/ת עסק"}'::jsonb),
('how_it_works', '{"section_title": "שלושה צעדים פשוטים", "step1_title": "בחרו מוצר", "step1_desc": "גלו מוצרים מעניינים מעסקים מובילים ושלחו בקשת חיבור", "step2_title": "צלמו סרטון", "step2_desc": "קבלו את המוצר חינם וצלמו סרטון UGC אותנטי תוך 10 ימים", "step3_title": "צמחו", "step3_desc": "צברו ניסיון, עלו ברמות, והפכו ליוצרי תוכן מבוקשים"}'::jsonb),
('creators', '{"title_line1": "הפכו את", "title_line2": "התשוקה למקצוע", "benefit1": "קבלו מוצרים חינם מהמותגים המובילים", "benefit2": "צלמו תוכן בסגנון שלכם, בקצב שלכם", "benefit3": "צמחו עם מערכת דירוגים ייחודית", "benefit4": "בנו פורטפוליו מקצועי מרשים", "cta": "הצטרפו כיוצרי תוכן"}'::jsonb),
('stats', '{"stat1_value": "500+", "stat1_label": "יוצרי תוכן פעילים", "stat2_value": "200+", "stat2_label": "מותגים ועסקים", "stat3_value": "2,000+", "stat3_label": "סרטונים שנוצרו"}'::jsonb),
('brands', '{"title_line1": "תוכן שעובד", "title_line2": "בלי הפקות יקרות", "benefit1": "תוכן UGC אותנטי שמביא תוצאות", "benefit2": "מחירים שפויים — קרדיט אחד = סרטון אחד", "benefit3": "יוצרים מאומתים ומדורגים", "benefit4": "ניהול קל דרך לוח בקרה חכם", "cta": "הצטרפו כמפרסמים"}'::jsonb),
('cta_final', '{"title_line1": "מוכנים", "title_line2": "להתחיל?", "subtitle": "הצטרפו לקהילת היוצרים והמותגים הגדלה. חינם לגמרי ליוצרי תוכן.", "cta_primary": "הרשמה חינם", "cta_secondary": "אני מפרסם"}'::jsonb),
('footer', '{"tagline": "הפלטפורמה ליוצרי תוכן ומותגים", "copyright": "Mashpianim. כל הזכויות שמורות."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO site_settings (id, data) VALUES
('general', '{"platform_name": "Mashpianim", "support_email": "support@mashpianim.co.il", "support_phone": "03-1234567"}'::jsonb),
('credits', '{"single_price": 100, "pack_5_price": 450, "pack_10_price": 800, "pack_20_price": 1400}'::jsonb),
('moderation', '{"auto_ocr": true, "chat_filter": true, "speech_detection": true, "nsfw_filter": true}'::jsonb),
('timelines', '{"shipping_days": 7, "filming_days": 10, "review_days": 7, "max_revisions": 1}'::jsonb)
ON CONFLICT (id) DO NOTHING;
