import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const LAST_AUTH_PROVIDER_KEY = 'last_auth_provider';

export type AuthProvider = 'google' | 'email';

/**
 * 最後に使用した認証プロバイダーを保存する
 * WebではlocalStorage、iOS/Androidではexpo-secure-storeを使用
 * @param provider 認証プロバイダー（'google' または 'email'）
 */
export async function saveLastAuthProvider(provider: AuthProvider): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_AUTH_PROVIDER_KEY, provider);
      }
    } else {
      await SecureStore.setItemAsync(LAST_AUTH_PROVIDER_KEY, provider);
    }
    console.log('[認証手段] 保存:', provider);
  } catch (error) {
    console.error('[認証手段] 保存エラー:', error);
    // エラーが発生してもアプリの動作を止めない
  }
}

/**
 * 最後に使用した認証プロバイダーを取得する
 * WebではlocalStorage、iOS/Androidではexpo-secure-storeを使用
 * @returns 認証プロバイダー（'google' または 'email'）、保存されていない場合は null
 */
export async function getLastAuthProvider(): Promise<AuthProvider | null> {
  try {
    let provider: string | null = null;
    
    if (Platform.OS === 'web') {
      provider = typeof window !== 'undefined'
        ? window.localStorage.getItem(LAST_AUTH_PROVIDER_KEY)
        : null;
    } else {
      provider = await SecureStore.getItemAsync(LAST_AUTH_PROVIDER_KEY);
    }
    
    if (provider === 'google' || provider === 'email') {
      return provider as AuthProvider;
    }
    return null;
  } catch (error) {
    console.error('[認証手段] 取得エラー:', error);
    return null;
  }
}

/**
 * 最後のログインがGoogle認証だったかを判定する
 * @returns true の場合、最後のログインはGoogle認証
 */
export async function wasLastLoginGoogle(): Promise<boolean> {
  const provider = await getLastAuthProvider();
  const result = provider === 'google';
  if (provider) {
    console.log('[認証手段] 前回:', provider === 'google' ? 'Google' : 'Email');
  }
  return result;
}

/**
 * 保存された認証プロバイダー情報を削除する（明示的なクリア時のみ）
 */
export async function clearLastAuthProvider(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LAST_AUTH_PROVIDER_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(LAST_AUTH_PROVIDER_KEY);
    }
    console.log('[認証手段] 削除完了');
  } catch (error) {
    console.error('[認証手段] 削除エラー:', error);
    // エラーが発生してもアプリの動作を止めない
  }
}
