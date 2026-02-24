import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** 認証後のリダイレクト先（必ず環境変数から組み立て。stg/prod で切り替える） */
export function getAuthCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.test-album.jp';
  return `${base.replace(/\/$/, '')}/auth/callback`;
}
