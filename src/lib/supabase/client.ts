import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getPublicSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase 公开环境变量未配置");
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}