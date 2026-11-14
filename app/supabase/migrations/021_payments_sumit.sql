-- 021_payments_sumit: online purchase of credit packages through SUMIT's hosted payment page (owner, 2026-11-14).
--
-- Additive, no data change. `transactions` (001) gains the provider bookkeeping of an order; `brand_profiles`
-- keeps the invoice details a business typed once, and its SUMIT customer id after the first paid order.
-- Writes go through the service-role API only (client roles are read-only since 007).

alter table public.transactions
  add column if not exists package text,
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_customer_id text,
  add column if not exists document_id text,
  add column if not exists completed_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists billing_name text,
  add column if not exists billing_company_number text,
  add column if not exists billing_email text;

create index if not exists transactions_brand_created_idx on public.transactions (brand_id, created_at desc);
create index if not exists transactions_status_provider_idx on public.transactions (status, provider);

alter table public.brand_profiles
  add column if not exists billing_name text,
  add column if not exists billing_company_number text,
  add column if not exists billing_email text,
  add column if not exists sumit_customer_id text;
