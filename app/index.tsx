import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default function Index() {
  const router = useRouter();
  const { authLoading, sessionUserId } = useAuth();
  const didRedirectRef = useRef(false);

  useEffect(() => {
    if (authLoading) {
      debugLog('[Index] authLoading中...', { platform: Platform.OS });
      return;
    }

    if (didRedirectRef.current) return;
    didRedirectRef.current = true;

    if (sessionUserId) {
      debugLog('[Index] ログイン済み(sessionUserIdあり)、タブへ遷移', { platform: Platform.OS });
      router.replace('/(tabs)');
    } else {
      debugLog('[Index] 未ログイン、ログイン画面にリダイレクト', { platform: Platform.OS });
      router.replace('/(auth)/login');
    }
  }, [
    authLoading,
    sessionUserId,
    router,
  ]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.message}>確認中...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  message: {
    marginTop: 12,
    fontSize: 12,
    color: '#666',
  },
});
