import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { createAuthStorage } from '@/lib/authStorage';
import Constants from 'expo-constants';

const getExtraString = (key: string) => {
  const extra =
    Constants.expoConfig?.extra ??
    // expo-constants の旧形式向けのフォールバック
    (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra ??
    {};
  const value = extra[key];
  return typeof value === 'string' ? value : '';
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || getExtraString('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || getExtraString('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const isPlaceholder = (v: string) =>
  !v ||
  v === 'your_supabase_project_url' ||
  v === 'your_supabase_anon_key';

export const isSupabaseConfigured = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

export const supabaseConfigError =
  'Supabase の設定がありません。\n' +
  '1. .env.example を .env にコピーする\n' +
  '2. .env の EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY に Supabase の実際の値を設定する\n' +
  '3. 開発サーバーを再起動する (npm run dev)';

const createUnavailableClient = () => {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(supabaseConfigError);
      },
    }
  ) as ReturnType<typeof createClient>;
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: createAuthStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
        // WebはImplicitフローを使用してcode_verifier問題を回避
        ...(Platform.OS === 'web' ? { flowType: 'implicit' as const } : {}),
      },
      global: {
        // リフレッシュトークンエラーを適切に処理
        headers: {
          'x-client-info': `expo-go/${Platform.OS}`,
        },
      },
    })
  : createUnavailableClient();
