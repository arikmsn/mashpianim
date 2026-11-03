-- 014: platform_usage() — database and file-storage size for the admin capacity gauge (/admin) and the
-- daily cron alert (lib/capacity.ts). SECURITY DEFINER because pg_database_size() and storage.objects need
-- elevated rights; only the service role (API routes, cron) may call it — never the browser roles.
-- Additive, no data change; safe to apply at any time.

create or replace function public.platform_usage()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, storage
as $$
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'storage_objects', (select count(*) from storage.objects),
    'videos_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'videos'), 0),
    'measured_at', now()
  );
$$;

revoke all on function public.platform_usage() from public;
revoke all on function public.platform_usage() from anon;
revoke all on function public.platform_usage() from authenticated;
grant execute on function public.platform_usage() to service_role;
