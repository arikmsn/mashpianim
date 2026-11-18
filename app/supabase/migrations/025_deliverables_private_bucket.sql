-- 025_deliverables_private_bucket: a private bucket for connection deliverable videos (owner, 2026-11-18: keep
-- the delivery videos private). The `videos` bucket is public (024) so the portfolio gallery loads fast from the
-- CDN, but the paid deliverables a creator uploads for a business must not be reachable by URL. They move to this
-- private bucket; the app reads them only through short-lived signed URLs minted by the service role after it has
-- checked the caller is a party to the connection. Creators upload here directly (authenticated INSERT, limited to
-- their own portfolio/<auth-uid>/… folder, same shape as the videos bucket). Existing objects are moved out of
-- `videos` into here separately (a one-off storage copy + delete).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deliverables', 'deliverables', false, 157286400,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'])
on conflict (id) do nothing;

-- A creator may upload a deliverable into their own folder (the path is portfolio/<auth-uid>/connections/<id>/…)
drop policy if exists "auth_users_upload_deliverables" on storage.objects;
create policy "auth_users_upload_deliverables" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[1] = 'portfolio'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );

-- The service role reads (to sign), copies and deletes deliverables; clients never read this bucket directly
drop policy if exists "service_role_deliverables_all" on storage.objects;
create policy "service_role_deliverables_all" on storage.objects
  for all to service_role
  using (bucket_id = 'deliverables')
  with check (bucket_id = 'deliverables');
