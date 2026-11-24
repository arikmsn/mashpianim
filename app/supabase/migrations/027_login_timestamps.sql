-- 027: מתי החשבון נכנס לאחרונה (רשימות היוצרים והעסקים במנהל; בעל המערכת, 2026-11-24)
-- last_login_at = הכניסה האחרונה שהושלמה (קוד אומת / הרשמה / כניסת בדיקה), previous_login_at = זו שלפניה.
-- users.last_seen_at (019) נשאר "פעילות אחרונה": חותמת כל 10 דקות מקריאות הפרופיל, לא כניסה.

alter table public.users add column if not exists last_login_at timestamptz;
alter table public.users add column if not exists previous_login_at timestamptz;

-- נקודת התחלה: הפעילות האחרונה הידועה (אין היסטוריית כניסות קודמת)
update public.users set last_login_at = last_seen_at where last_login_at is null and last_seen_at is not null;
