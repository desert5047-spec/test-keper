import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log, warn } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
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

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || getExtraString('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || getExtraString('EXPO_PUBLIC_SUPABASE_ANON_KEY');

/** 環境ラベル（stg / prod / dev）。EAS プロファイルや .env で設定 */
export const envLabel =
  process.env.EXPO_PUBLIC_ENV || getExtraString('EXPO_PUBLIC_ENV') || 'dev';
/** Storage バケット名。EAS プロファイルや .env で設定 */
export const storageBucket =
  process.env.EXPO_PUBLIC_STORAGE_BUCKET || getExtraString('EXPO_PUBLIC_STORAGE_BUCKET') || 'test-images';

if (!supabaseUrl || !supabaseAnonKey) {
  warn('[Supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定です');
}

const isPlaceholder = (v: string) =>
  !v ||
  v === 'your_supabase_project_url' ||
  v === 'your_supabase_anon_key';

export const isSupabaseConfigured = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

// 事故防止: 起動時に接続先の host だけをログ（キーは出さない）
if (isSupabaseConfigured && supabaseUrl) {
  try {
    const host = new URL(supabaseUrl).hostname;
    log('[Supabase] 接続先 host:', host);
  } catch {
    // URL パース失敗時は無視
  }
}

export const supabaseConfigError =
  'Supabase の設定がありません。\n' +
  '1. .env.example を .env.stg または .env.prod にコピーする\n' +
  '2. EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY に Supabase の値を設定する\n' +
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
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
      global: {
        // リフレッシュトークンエラーを適切に処理
        headers: {
          'x-client-info': `expo-go/${Platform.OS}`,
        },
      },
    })
  : createUnavailableClient();

// 無効なリフレッシュトークンで未処理の Promise 拒否が発生した場合、可能な限り早く拾ってセッションをクリアする（ERROR ログ抑止のためモジュール読み込み時に登録）
if (isSupabaseConfigured) {
  const g =
    typeof globalThis !== 'undefined'
      ? (globalThis as typeof globalThis & { addEventListener?: (type: string, fn: (e: any) => void) => void })
      : typeof global !== 'undefined'
        ? (global as typeof global & { addEventListener?: (type: string, fn: (e: any) => void) => void })
        : null;
  if (g?.addEventListener) {
    g.addEventListener('unhandledrejection', (event: { reason?: unknown; preventDefault?: () => void }) => {
      const reason = event?.reason;
      if (!reason || typeof reason !== 'object') return;
      const msg = String((reason as { message?: string }).message ?? '');
      const name = (reason as { name?: string }).name ?? '';
      const isRefreshTokenError =
        name === 'AuthApiError' ||
        msg.includes('Refresh Token') ||
        msg.includes('refresh_token') ||
        msg.includes('Refresh Token Not Found') ||
        msg.includes('Invalid Refresh Token');
      if (isRefreshTokenError) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        supabase.auth.signOut().catch(() => {});
      }
    });
  }
}
