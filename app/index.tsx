import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // loadingが完了するまで待つ
    if (loading) {
      console.log('[Index] 認証状態を読み込み中...', { platform: Platform.OS });
      return;
    }

    // 未ログインの場合はログイン画面にリダイレクト
    if (!user) {
      console.log('[Index] 未ログイン、ログイン画面にリダイレクト', { platform: Platform.OS });
      try {
        router.replace('/(auth)/login');
      } catch (error) {
        console.error('[Index] リダイレクトエラー:', error);
      }
      return;
    }

    // ログイン済みの場合はオンボーディング状態をチェック
    console.log('[Index] ログイン済み、オンボーディング状態をチェック', { userId: user.id, platform: Platform.OS });
    checkOnboardingStatus();
  }, [user, loading]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    const onboardingKey = `hasCompletedOnboarding_${user.id}`;
    const hasCompleted = await AsyncStorage.getItem(onboardingKey);

    if (hasCompleted) {
      const { data: children } = await supabase
        .from('children')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (children && children.length > 0) {
        console.log('[Index] オンボーディング完了、タブ画面にリダイレクト');
        router.replace('/(tabs)');
      } else {
        console.log('[Index] 子供未登録、子供登録画面にリダイレクト');
        router.replace('/register-child');
      }
    } else {
      console.log('[Index] オンボーディング未完了、オンボーディング画面にリダイレクト');
      router.replace('/onboarding');
    }
  };

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
