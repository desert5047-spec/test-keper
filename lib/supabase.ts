import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { createAuthStorage } from '@/lib/authStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isPlaceholder = (v: string) =>
  !v ||
  v === 'your_supabase_project_url' ||
  v === 'your_supabase_anon_key';

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
  throw new Error(
    'Supabase の設定がありません。\n' +
      '1. .env.example を .env にコピーする\n' +
      '2. .env の EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY に Supabase の実際の値を設定する\n' +
      '3. 開発サーバーを再起動する (npm run dev)'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
