import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REMEMBER_ME_KEY = 'rememberMe';

const memoryStore = new Map<string, string>();

const memoryStorage = {
  getItem: async (key: string) => memoryStore.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memoryStore.set(key, value);
  },
  removeItem: async (key: string) => {
    memoryStore.delete(key);
  },
};

const SECURESTORE_VALUE_LIMIT = 2000;
const SECURESTORE_TIMEOUT_MS = 2000;

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  return Promise.race([promise, timeoutPromise]);
};

const secureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        console.warn('[authStorage] AsyncStorage getItem エラー:', error);
        return null;
      }
    }
    
    try {
      const available = await withTimeout(
        SecureStore.isAvailableAsync(),
        SECURESTORE_TIMEOUT_MS,
        'SecureStore.isAvailableAsync'
      );
      if (!available) {
        return await AsyncStorage.getItem(key);
      }
      
      // SecureStoreから取得を試みる
      const secureValue = await withTimeout(
        SecureStore.getItemAsync(key),
        SECURESTORE_TIMEOUT_MS,
        'SecureStore.getItemAsync'
      );
      if (secureValue !== null) {
        return secureValue;
      }
      
      // SecureStoreにない場合はAsyncStorageから取得を試みる
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue !== null) {
        // AsyncStorageにあった場合は、SecureStoreにも保存（次回からSecureStoreを使用）
        try {
          if (asyncValue.length <= SECURESTORE_VALUE_LIMIT) {
            await SecureStore.setItemAsync(key, asyncValue);
          }
        } catch (error) {
          // SecureStoreへの保存に失敗しても続行
          console.warn('[authStorage] SecureStoreへの移行失敗:', error);
        }
        return asyncValue;
      }
      
      return null;
    } catch (error) {
      console.warn('[authStorage] secureStorage getItem エラー:', error);
      // エラー時はAsyncStorageから取得を試みる
      try {
        return await AsyncStorage.getItem(key);
      } catch (asyncError) {
        console.warn('[authStorage] AsyncStorage getItem フォールバックエラー:', asyncError);
        return null;
      }
    }
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        await AsyncStorage.setItem(key, value);
        return;
      } catch (error) {
        console.warn('[authStorage] AsyncStorage setItem エラー:', error);
        return;
      }
    }
    
    try {
      const available = await withTimeout(
        SecureStore.isAvailableAsync(),
        SECURESTORE_TIMEOUT_MS,
        'SecureStore.isAvailableAsync'
      );
      if (!available) {
        await AsyncStorage.setItem(key, value);
        return;
      }
      
      // 値が大きい場合はAsyncStorageに保存
      if (value.length > SECURESTORE_VALUE_LIMIT) {
        await AsyncStorage.setItem(key, value);
        return;
      }
      
      // SecureStoreに保存を試みる
      try {
        await withTimeout(
          SecureStore.setItemAsync(key, value),
          SECURESTORE_TIMEOUT_MS,
          'SecureStore.setItemAsync'
        );
        // 成功した場合もAsyncStorageにバックアップを保存
        try {
          await AsyncStorage.setItem(key, value);
        } catch (backupError) {
          // バックアップ失敗は警告のみ
          console.warn('[authStorage] AsyncStorageバックアップ失敗:', backupError);
        }
      } catch (secureError) {
        // SecureStoreに失敗した場合はAsyncStorageに保存
        console.warn('[authStorage] SecureStore setItem エラー、AsyncStorageにフォールバック:', secureError);
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('[authStorage] secureStorage setItem エラー:', error);
      // 最終的にAsyncStorageに保存を試みる
      try {
        await AsyncStorage.setItem(key, value);
      } catch (asyncError) {
        console.error('[authStorage] AsyncStorage setItem フォールバックエラー:', asyncError);
      }
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        await AsyncStorage.removeItem(key);
        return;
      } catch (error) {
        console.warn('[authStorage] AsyncStorage removeItem エラー:', error);
        return;
      }
    }
    
    try {
      const available = await withTimeout(
        SecureStore.isAvailableAsync(),
        SECURESTORE_TIMEOUT_MS,
        'SecureStore.isAvailableAsync'
      );
      if (!available) {
        await AsyncStorage.removeItem(key);
        return;
      }
      
      // 両方から削除を試みる
      try {
        await withTimeout(
          SecureStore.deleteItemAsync(key),
          SECURESTORE_TIMEOUT_MS,
          'SecureStore.deleteItemAsync'
        );
      } catch (secureError) {
        console.warn('[authStorage] SecureStore deleteItem エラー:', secureError);
      }
      
      try {
        await AsyncStorage.removeItem(key);
      } catch (asyncError) {
        console.warn('[authStorage] AsyncStorage removeItem エラー:', asyncError);
      }
    } catch (error) {
      console.warn('[authStorage] secureStorage removeItem エラー:', error);
    }
  },
};

export const getRememberMe = async () => {
  const value = await AsyncStorage.getItem(REMEMBER_ME_KEY);
  if (value === null) {
    return true;
  }
  return value === 'true';
};

export const setRememberMe = async (value: boolean) => {
  await AsyncStorage.setItem(REMEMBER_ME_KEY, value ? 'true' : 'false');
};

export const createAuthStorage = () => ({
  getItem: async (key: string) => {
    try {
      const rememberMe = await getRememberMe();
      if (rememberMe) {
        const value = await secureStorage.getItem(key);
        // トークン関連のキーの場合、見つからない場合はnullを返す（エラーを発生させない）
        if (value === null && (key.includes('refresh_token') || key.includes('access_token'))) {
          console.warn('[authStorage] トークンが見つかりません:', key);
          return null;
        }
        return value;
      }
      return await memoryStorage.getItem(key);
    } catch (error) {
      console.error('[authStorage] getItem エラー:', error);
      // エラー時はnullを返す（Supabaseが適切に処理する）
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      const rememberMe = await getRememberMe();
      if (rememberMe) {
        await secureStorage.setItem(key, value);
        return;
      }
      await memoryStorage.setItem(key, value);
    } catch (error) {
      console.error('[authStorage] setItem エラー:', error);
      // エラーはログに記録するが、例外を投げない（Supabaseの処理を続行）
    }
  },
  removeItem: async (key: string) => {
    try {
      const rememberMe = await getRememberMe();
      if (rememberMe) {
        await secureStorage.removeItem(key);
        return;
      }
      await memoryStorage.removeItem(key);
    } catch (error) {
      console.error('[authStorage] removeItem エラー:', error);
      // エラーはログに記録するが、例外を投げない
    }
  },
});
