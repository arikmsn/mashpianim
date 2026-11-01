-- Mashpianim Database Schema
-- Run this in Supabase SQL Editor

-- Enums
CREATE TYPE user_type AS ENUM ('creator', 'brand', 'admin');
CREATE TYPE connection_status AS ENUM (
  'pending', 'approved', 'rejected', 'shipped', 'filming',
  'uploaded', 'in_review', 'revision_requested', 'completed', 'cancelled'
);
CREATE TYPE video_status AS ENUM ('pending', 'approved', 'revision_requested');
CREATE TYPE creator_level AS ENUM ('creator', 'creator_plus', 'on_the_radar');
CREATE TYPE product_status AS ENUM ('active', 'paused', 'deleted');
CREATE TYPE shipping_policy AS ENUM ('free', 'paid', 'pickup');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE referral_status AS ENUM ('pending', 'completed');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type user_type NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  avatar_url TEXT,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Creator Profiles
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  tiktok_handle TEXT,
  tiktok_followers INT NOT NULL DEFAULT 0,
  instagram_handle TEXT,
  instagram_followers INT NOT NULL DEFAULT 0,
  categories TEXT[] NOT NULL DEFAULT '{}',
  level creator_level NOT NULL DEFAULT 'creator',
  hearts INT NOT NULL DEFAULT 0,
  completed_connections INT NOT NULL DEFAULT 0,
  intro_video_url TEXT,
  city TEXT,
  date_of_birth DATE,
  UNIQUE(user_id)
);

-- Brand Profiles
CREATE TABLE brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  logo_url TEXT,
  category TEXT NOT NULL,
  website_url TEXT,
  description TEXT,
  total_credits INT NOT NULL DEFAULT 0,
  used_credits INT NOT NULL DEFAULT 0,
  UNIQUE(user_id)
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  shipping_policy shipping_policy NOT NULL DEFAULT 'free',
  shipping_address TEXT,
  status product_status NOT NULL DEFAULT 'active',
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Connections
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(id),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id),
  product_id UUID NOT NULL REFERENCES products(id),
  status connection_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  filmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  ship_deadline TIMESTAMPTZ,
  film_deadline TIMESTAMPTZ,
  review_deadline TIMESTAMPTZ,
  rejection_reason TEXT,
  revision_notes TEXT
);

-- Videos
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  status video_status NOT NULL DEFAULT 'pending',
  revision_notes TEXT,
  moderation_flags TEXT[] NOT NULL DEFAULT '{}',
  ai_review_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credits
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id),
  total INT NOT NULL,
  used INT NOT NULL DEFAULT 0,
  package_name TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  credits INT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_ref TEXT,
  status transaction_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Referrals
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_brand_id UUID NOT NULL REFERENCES brand_profiles(id),
  referred_brand_id UUID REFERENCES brand_profiles(id),
  code TEXT NOT NULL UNIQUE,
  status referral_status NOT NULL DEFAULT 'pending',
  credits_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_creator_profiles_user ON creator_profiles(user_id);
CREATE INDEX idx_brand_profiles_user ON brand_profiles(user_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_connections_creator ON connections(creator_id);
CREATE INDEX idx_connections_brand ON connections(brand_id);
CREATE INDEX idx_connections_status ON connections(status);
CREATE INDEX idx_videos_connection ON videos(connection_id);
CREATE INDEX idx_messages_connection ON messages(connection_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read = false;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users: can read own, admins read all
CREATE POLICY users_read_own ON users FOR SELECT USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND type = 'admin')
);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id);

-- Creator profiles: public read, own write
CREATE POLICY creator_profiles_read ON creator_profiles FOR SELECT USING (true);
CREATE POLICY creator_profiles_write ON creator_profiles FOR ALL USING (
  user_id = auth.uid()
);

-- Brand profiles: public read, own write
CREATE POLICY brand_profiles_read ON brand_profiles FOR SELECT USING (true);
CREATE POLICY brand_profiles_write ON brand_profiles FOR ALL USING (
  user_id = auth.uid()
);

-- Products: public read active, brand owner write
CREATE POLICY products_read ON products FOR SELECT USING (
  status = 'active' OR
  brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
);
CREATE POLICY products_write ON products FOR ALL USING (
  brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
);

-- Connections: participants read/write
CREATE POLICY connections_read ON connections FOR SELECT USING (
  creator_id IN (SELECT id FROM creator_profiles WHERE user_id = auth.uid()) OR
  brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND type = 'admin')
);
CREATE POLICY connections_insert ON connections FOR INSERT WITH CHECK (
  creator_id IN (SELECT id FROM creator_profiles WHERE user_id = auth.uid())
);
CREATE POLICY connections_update ON connections FOR UPDATE USING (
  creator_id IN (SELECT id FROM creator_profiles WHERE user_id = auth.uid()) OR
  brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
);

-- Videos: connection participants
CREATE POLICY videos_read ON videos FOR SELECT USING (
  connection_id IN (
    SELECT id FROM connections WHERE
      creator_id IN (SELECT id FROM creator_profiles WHERE user_id = auth.uid()) OR
      brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
  )
);
CREATE POLICY videos_insert ON videos FOR INSERT WITH CHECK (
  connection_id IN (
    SELECT id FROM connections WHERE
      creator_id IN (SELECT id FROM creator_profiles WHERE user_id = auth.uid())
  )
);

-- Messages: connection participants
CREATE POLICY messages_read ON messages FOR SELECT USING (
  connection_id IN (
    SELECT id FROM connections WHERE
      creator_id IN (SELECT id FROM creator_profiles WHERE user_id = auth.uid()) OR
      brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
  )
);
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  connection_id IN (
    SELECT id FROM connections WHERE
      creator_id IN (SELECT id FROM creator_profiles WHERE user_id = auth.uid()) OR
      brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
  )
);

-- Credits: brand owner read
CREATE POLICY credits_read ON credits FOR SELECT USING (
  brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
);

-- Transactions: brand owner read
CREATE POLICY transactions_read ON transactions FOR SELECT USING (
  brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
);

-- Notifications: own only
CREATE POLICY notifications_read ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Referrals: brand owner
CREATE POLICY referrals_read ON referrals FOR SELECT USING (
  referrer_brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid()) OR
  referred_brand_id IN (SELECT id FROM brand_profiles WHERE user_id = auth.uid())
);

-- Enable Realtime for chat and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
