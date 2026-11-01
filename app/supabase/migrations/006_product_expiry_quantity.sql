-- Add expiration date and quantity fields to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS max_creators integer DEFAULT 3;
