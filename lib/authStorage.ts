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

const secureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    const available = await SecureStore.isAvailableAsync();
    if (!available) {
      return AsyncStorage.getItem(key);
    }
    const value = await SecureStore.getItemAsync(key);
    if (value === null) {
      return AsyncStorage.getItem(key);
    }
    return value;
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    const available = await SecureStore.isAvailableAsync();
    if (!available) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    if (value.length > SECURESTORE_VALUE_LIMIT) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    const available = await SecureStore.isAvailableAsync();
    if (!available) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
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
    const rememberMe = await getRememberMe();
    return rememberMe ? secureStorage.getItem(key) : memoryStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    const rememberMe = await getRememberMe();
    if (rememberMe) {
      await secureStorage.setItem(key, value);
      return;
    }
    await memoryStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    const rememberMe = await getRememberMe();
    if (rememberMe) {
      await secureStorage.removeItem(key);
      return;
    }
    await memoryStorage.removeItem(key);
  },
});
