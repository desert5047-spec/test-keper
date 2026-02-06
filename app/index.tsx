import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default function Index() {
  const router = useRouter();
  const {
    user,
    loading,
    familyId,
    isFamilyReady,
    isSetupReady,
    needsDisplayName,
    needsChildSetup,
    refreshSetupStatus,
  } = useAuth();
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    // loadingが完了するまで待つ
    if (loading) {
      debugLog('[Index] 認証状態を読み込み中...', { platform: Platform.OS });
      return;
    }

    // 未ログインの場合はログイン画面にリダイレクト
    if (!user) {
      debugLog('[Index] 未ログイン、ログイン画面にリダイレクト', { platform: Platform.OS });
      try {
        router.replace('/(auth)/login');
      } catch (error) {
        console.error('[Index] リダイレクトエラー');
      }
      return;
    }

    if (!isFamilyReady || !familyId) {
      debugLog('[Index] familyId 未確定のため待機', { platform: Platform.OS });
      return;
    }

    if (!isSetupReady) {
      if (!refreshInFlightRef.current) {
        refreshInFlightRef.current = true;
        debugLog('[Index] セットアップ状態を確認中...', { platform: Platform.OS });
        refreshSetupStatus().finally(() => {
          refreshInFlightRef.current = false;
        });
      }
      return;
    }

    if (needsDisplayName || needsChildSetup) {
      debugLog('[Index] セットアップ未完了、オンボーディング画面へ');
      router.replace('/onboarding');
      return;
    }

    debugLog('[Index] セットアップ完了、タブ画面へ');
    router.replace('/(tabs)');
  }, [
    user,
    loading,
    isFamilyReady,
    familyId,
    isSetupReady,
    needsDisplayName,
    needsChildSetup,
    refreshSetupStatus,
    router,
  ]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
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
});
