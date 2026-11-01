import { createClient } from "@/lib/supabase/server";

export async function verifyAdmin() {
  const supabaseConfigured =
    process.env.NEXT_SUPABASE_URL &&
    process.env.NEXT_SUPABASE_ANON_KEY;

  if (!supabaseConfigured) {
    return { isAdmin: true, userId: "mock-admin", supabase: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, userId: null, supabase };
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("type")
    .eq("auth_user_id", user.id)
    .single();

  return {
    isAdmin: (dbUser as any)?.type === "admin",
    userId: user.id,
    supabase,
  };
}

export function isSupabaseConfigured() {
  return !!(
    process.env.NEXT_SUPABASE_URL &&
    process.env.NEXT_SUPABASE_ANON_KEY
  );
}
