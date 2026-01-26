import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    // Web環境でのOAuthコールバック処理
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleCallback = async () => {
        try {
          // URLからハッシュフラグメントを取得
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            // セッションを設定
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('セッション設定エラー:', error);
              router.replace('/(auth)/login');
              return;
            }

            // 認証成功後、メイン画面にリダイレクト
            router.replace('/(tabs)');
          } else {
            // トークンが見つからない場合、セッションを確認
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (session && !error) {
              router.replace('/(tabs)');
            } else {
              router.replace('/(auth)/login');
            }
          }
        } catch (err) {
          console.error('コールバック処理エラー:', err);
          router.replace('/(auth)/login');
        }
      };

      handleCallback();
    } else {
      // ネイティブ環境では、この画面は使用されない
      router.replace('/(auth)/login');
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.text}>認証処理中...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
});
