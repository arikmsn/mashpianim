import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verifyAdmin(): Promise<{ isAdmin: boolean; userId: string | null; supabase: any }> {
  const supabaseUrl = process.env.NEXT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SEC_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { isAdmin: false, userId: null, supabase: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, userId: null, supabase };
  }

  // Use service role client to bypass RLS when checking admin status
  if (supabaseServiceKey) {
    const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey);
    const { data: dbUser } = await adminClient
      .from("users")
      .select("type")
      .eq("auth_user_id", user.id)
      .single();

    if ((dbUser as any)?.type === "admin") {
      // Return service role client so admin operations bypass RLS too
      return { isAdmin: true, userId: user.id, supabase: adminClient as any };
    }
    return { isAdmin: false, userId: user.id, supabase: supabase as any };
  }

  // Fallback: try with anon client (may fail if RLS blocks)
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
