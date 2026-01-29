import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

// 方案1: storage adapterの保存キーを固定して削除を確実にする
// SecureStoreのキー制約に合わせて ":" を使わない
export const SUPABASE_SESSION_KEY = 'sb_session_v2';
const isValidSecureStoreKey = (key: string) => /^[A-Za-z0-9._-]+$/.test(key);

const storage = {
  getItem: async (_key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(SUPABASE_SESSION_KEY);
    }
    if (!isValidSecureStoreKey(SUPABASE_SESSION_KEY)) {
      return null;
    }
    try {
      return await SecureStore.getItemAsync(SUPABASE_SESSION_KEY);
    } catch (error) {
      console.warn('[supabase] SecureStore getItem 失敗:', error);
      return null;
    }
  },
  setItem: async (_key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(SUPABASE_SESSION_KEY, value);
      return;
    }
    if (!isValidSecureStoreKey(SUPABASE_SESSION_KEY)) {
      return;
    }
    try {
      await SecureStore.setItemAsync(SUPABASE_SESSION_KEY, value);
    } catch (error) {
      console.warn('[supabase] SecureStore setItem 失敗:', error);
    }
  },
  removeItem: async (_key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(SUPABASE_SESSION_KEY);
      return;
    }
    if (!isValidSecureStoreKey(SUPABASE_SESSION_KEY)) {
      return;
    }
    try {
      await SecureStore.deleteItemAsync(SUPABASE_SESSION_KEY);
    } catch (error) {
      console.warn('[supabase] SecureStore removeItem 失敗:', error);
    }
  },
};

export const clearSupabaseSessionStorage = async () => {
  await storage.removeItem(SUPABASE_SESSION_KEY);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: SUPABASE_SESSION_KEY,
    storage,
  },
});
