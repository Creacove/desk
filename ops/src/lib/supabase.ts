import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const normalizedUrl = url?.trim();
const normalizedAnonKey = anonKey?.trim();

export const supabaseConfigured = Boolean(isValidSupabaseUrl(normalizedUrl) && normalizedAnonKey);
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(normalizedUrl!, normalizedAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error("Ops is not configured yet. Add the Supabase URL and anon key.");
  return supabase;
}
