-- 008_revoke_maintain.sql
-- Companion to 007: PostgreSQL 17 adds the MAINTAIN privilege (VACUUM/ANALYZE/REINDEX/LOCK TABLE), which the
-- Supabase default ACL also grants to the client roles. Leave anon / authenticated with SELECT only.

revoke maintain on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke maintain on tables from anon, authenticated;
