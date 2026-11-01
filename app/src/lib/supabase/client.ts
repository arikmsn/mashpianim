import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (cached) return cached;
  const url = process.env.NEXT_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }
  cached = createBrowserClient<Database>(url, key);
  return cached;
}

export function isClientConfigured() {
  return !!(process.env.NEXT_SUPABASE_URL && process.env.NEXT_SUPABASE_ANON_KEY);
}
