import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const processAuthCallback = async (url: string | null) => {
      try {
        console.log('[コールバック] 処理開始:', { url, platform: Platform.OS });
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Web環境でのOAuthコールバック処理
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          console.log('[コールバック] Web環境で処理中');
          // URLからハッシュフラグメントを取得
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          console.log('[コールバック] Webから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
        } else if (url) {
          console.log('[コールバック] ネイティブ環境でURLを処理中:', url);
          // iOS/Android環境での深いリンク処理
          // カスタムスキーム（myapp://）のURLを処理
          const parsedUrl = Linking.parse(url);
          console.log('[コールバック] パースされたURL:', parsedUrl);
          
          // クエリパラメータからトークンを取得
          if (parsedUrl.queryParams) {
            accessToken = parsedUrl.queryParams.access_token as string || null;
            refreshToken = parsedUrl.queryParams.refresh_token as string || null;
            console.log('[コールバック] クエリパラメータから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
          }
          
          // URL文字列から直接フラグメント（#）を検索（Supabaseのデフォルト形式）
          if (!accessToken && url.includes('#')) {
            console.log('[コールバック] フラグメントからトークンを検索中');
            const hashIndex = url.indexOf('#');
            const hashPart = url.substring(hashIndex + 1);
            const hashParams = new URLSearchParams(hashPart);
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
            console.log('[コールバック] フラグメントから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
          }
        } else {
          console.log('[コールバック] URLがありません。セッションを確認します。');
        }

        if (accessToken && refreshToken) {
          console.log('[コールバック] セッションを設定中...');
          // セッションを設定
          const { error, data: sessionData } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[コールバック] セッション設定エラー:', error);
            router.replace('/(auth)/login');
            return;
          }

          console.log('[コールバック] セッション設定成功:', { userId: sessionData?.user?.id });
          // 認証成功後、メイン画面にリダイレクト
          router.replace('/(tabs)');
        } else {
          console.log('[コールバック] トークンが見つからないため、セッションを確認中...');
          // トークンが見つからない場合、セッションを確認
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session && !error) {
            console.log('[コールバック] 既存セッションを確認:', { userId: session.user?.id });
            router.replace('/(tabs)');
          } else {
            console.error('[コールバック] セッションが見つかりません:', error);
            router.replace('/(auth)/login');
          }
        }
      } catch (err) {
        console.error('[コールバック] 処理エラー:', err);
        router.replace('/(auth)/login');
      }
    };

    // 初期URLを処理（アプリが閉じている状態から開かれた場合）
    Linking.getInitialURL().then((url) => {
      if (url) {
        processAuthCallback(url);
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Web環境では常に処理
        processAuthCallback(null);
      } else {
        // ネイティブ環境でURLがない場合、セッションを確認
        processAuthCallback(null);
      }
    });

    // 深いリンクのリスナー（アプリが既に開いている状態でリンクが来た場合）
    const subscription = Linking.addEventListener('url', (event) => {
      processAuthCallback(event.url);
    });

    return () => {
      subscription.remove();
    };
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
