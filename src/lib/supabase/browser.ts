import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/auth";

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
