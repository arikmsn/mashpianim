-- OTP codes table for WhatsApp-based authentication
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Auto-delete expired codes (run periodically via cron or on each check)
CREATE INDEX idx_otp_codes_phone ON public.otp_codes (phone);
CREATE INDEX idx_otp_codes_expires ON public.otp_codes (expires_at);

-- RLS: only service role can access OTP codes
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — only service_role key accesses this table
