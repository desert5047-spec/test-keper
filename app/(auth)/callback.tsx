import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { url: paramUrlRaw } = useLocalSearchParams();
  const [errorMessage, setErrorMessage] = useState('');
  const isProcessingRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const paramUrl =
      typeof paramUrlRaw === 'string' && paramUrlRaw
        ? decodeURIComponent(paramUrlRaw)
        : null;
    const processAuthCallback = async (url: string | null) => {
      if (isProcessingRef.current) {
        console.log('[コールバック] 既に処理中のためスキップ');
        pendingUrlRef.current = url;
        return;
      }
      isProcessingRef.current = true;
      if (!watchdogRef.current) {
        watchdogRef.current = setTimeout(async () => {
          console.warn('[コールバック] 処理監視タイムアウト、セッション再確認中', { platform: Platform.OS });
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            console.log('[コールバック] 監視タイムアウト後にセッション検出:', { userId: session.user.id });
            router.replace('/(tabs)');
            return;
          }
          setErrorMessage('認証に時間がかかっています。もう一度お試しください。');
          router.replace('/(auth)/login');
        }, 45000);
      }
      try {
        const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timeout`)), ms);
          });
          return Promise.race([promise, timeoutPromise]);
        };
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const getSessionWithRetry = async (attempts = 3, delayMs = 500) => {
          for (let i = 0; i < attempts; i += 1) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              return session;
            }
            await wait(delayMs);
          }
          return null;
        };
        const waitForAuthEvent = async (timeoutMs = 20000) => {
          return new Promise<boolean>((resolve) => {
            const timeoutId = setTimeout(() => {
              subscription?.unsubscribe();
              resolve(false);
            }, timeoutMs);
            const { data } = supabase.auth.onAuthStateChange((event, session) => {
              if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
                clearTimeout(timeoutId);
                subscription?.unsubscribe();
                resolve(true);
              }
            });
            const subscription = data?.subscription;
          });
        };

        console.log('[コールバック] 処理開始:', { url, platform: Platform.OS });
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let authCode: string | null = null;
        let authType: string | null = null;

        // Web環境でのOAuthコールバック処理
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          console.log('[コールバック] Web環境で処理中');
          const searchParams = new URLSearchParams(window.location.search);
          authCode = searchParams.get('code');
          authType = searchParams.get('type');
          // URLからハッシュフラグメントを取得
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          console.log('[コールバック] Webから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
        } else if (url) {
          console.log('[コールバック] ネイティブ環境でURLを処理中:', url);
          // iOS/Android環境での深いリンク処理
          // カスタムスキーム（myapp://、exp://）のURLを処理
          
          // exp://スキームの場合、URL文字列から直接パラメータを抽出
          if (url.startsWith('exp://')) {
            console.log('[コールバック] exp://スキーム検出、URL文字列から直接抽出');
            // exp://host/path?query#fragment の形式を処理
            const queryIndex = url.indexOf('?');
            const hashIndex = url.indexOf('#');
            
            // クエリパラメータを抽出
            if (queryIndex !== -1) {
              const queryEnd = hashIndex !== -1 ? hashIndex : url.length;
              const queryString = url.substring(queryIndex + 1, queryEnd);
              const queryParams = new URLSearchParams(queryString);
              authCode = queryParams.get('code') || authCode;
              authType = queryParams.get('type') || authType;
              accessToken = queryParams.get('access_token') || accessToken;
              refreshToken = queryParams.get('refresh_token') || refreshToken;
              console.log('[コールバック] exp://クエリパラメータから取得:', { 
                hasCode: !!authCode,
                hasAccessToken: !!accessToken, 
                hasRefreshToken: !!refreshToken 
              });
            }
            
            // ハッシュフラグメントを抽出
            if (hashIndex !== -1) {
              const hashPart = url.substring(hashIndex + 1);
              if (hashPart.trim()) {
                const hashParams = new URLSearchParams(hashPart);
                accessToken = hashParams.get('access_token') || accessToken;
                refreshToken = hashParams.get('refresh_token') || refreshToken;
                authCode = hashParams.get('code') || authCode;
                authType = hashParams.get('type') || authType;
                console.log('[コールバック] exp://フラグメントから取得:', { 
                  hasCode: !!authCode,
                  hasAccessToken: !!accessToken, 
                  hasRefreshToken: !!refreshToken 
                });
              }
            }
          }
          
          // Linking.parseも試す（フォールバック）
          const parsedUrl = Linking.parse(url);
          console.log('[コールバック] パースされたURL:', parsedUrl);
          
          // クエリパラメータからトークンを取得（まだ取得できていない場合）
          if (parsedUrl.queryParams && (!accessToken || !authCode)) {
            accessToken = accessToken || (parsedUrl.queryParams.access_token as string) || null;
            refreshToken = refreshToken || (parsedUrl.queryParams.refresh_token as string) || null;
            authCode = authCode || (parsedUrl.queryParams.code as string) || null;
            authType = authType || (parsedUrl.queryParams.type as string) || null;
            console.log('[コールバック] Linking.parseから取得:', { 
              hasCode: !!authCode,
              hasAccessToken: !!accessToken, 
              hasRefreshToken: !!refreshToken 
            });
          }
          
          // URL文字列から直接フラグメント（#）を検索（Supabaseのデフォルト形式）
          if (!accessToken && url.includes('#')) {
            console.log('[コールバック] フラグメントからトークンを検索中');
            const hashIndex = url.indexOf('#');
            const hashPart = url.substring(hashIndex + 1);
            if (hashPart.trim()) {
              const hashParams = new URLSearchParams(hashPart);
              accessToken = hashParams.get('access_token') || accessToken;
              refreshToken = hashParams.get('refresh_token') || refreshToken;
              authCode = hashParams.get('code') || authCode;
              console.log('[コールバック] フラグメントから取得:', { 
                hasCode: !!authCode,
                hasAccessToken: !!accessToken, 
                hasRefreshToken: !!refreshToken 
              });
            }
          }
        } else {
          console.log('[コールバック] URLがありません。セッションを確認します。');
        }

        const type = authType
          ?? (Platform.OS === 'web' && typeof window !== 'undefined'
            ? new URLSearchParams(window.location.hash.substring(1)).get('type')
            : url
            ? (Linking.parse(url).queryParams?.type as string || null)
            : null);

        if (type === 'recovery' && accessToken) {
          console.log('[コールバック] パスワードリセットフローを検出');
          // パスワードリセット画面にリダイレクト
          router.replace({
            pathname: '/(auth)/reset-password',
            params: {
              access_token: accessToken,
              type: 'recovery',
            },
          });
          return;
        }

        if (authCode) {
          // Webでは Supabase が自動的にセッション交換するため、ここでは待機だけ行う
          if (Platform.OS === 'web') {
            console.log('[コールバック] Web: セッションの自動確立を待機中...');
            const gotEvent = await waitForAuthEvent(20000);
            if (!gotEvent) {
              console.warn('[コールバック] Web: 認証イベント待機がタイムアウト');
            }
            const autoSession = await getSessionWithRetry(30, 1000);
            if (autoSession?.user) {
              console.log('[コールバック] Web: 自動セッション検出', { userId: autoSession.user.id });
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, document.title, '/(tabs)');
              }
              router.replace('/(tabs)');
              return;
            }
            console.warn('[コールバック] Web: セッション確立に失敗（code_verifier不足の可能性）');
            setErrorMessage('認証に失敗しました。もう一度ログインしてください。');
            router.replace('/(auth)/login');
            return;
          }

          console.log('[コールバック] 認可コードを検出、セッション交換中...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (error) {
            console.error('[コールバック] セッション交換エラー:', error);
            setErrorMessage('認証に失敗しました。もう一度お試しください。');
            router.replace('/(auth)/login');
            return;
          }
          console.log('[コールバック] セッション交換成功:', { userId: data?.user?.id });
          router.replace('/(tabs)');
          return;
        }

        if (accessToken && refreshToken) {
          if (Platform.OS === 'web') {
            try {
              const { data: { session: existingSession } } = await withTimeout(
                supabase.auth.getSession(),
                8000,
                'getSession'
              );
              if (existingSession?.user) {
                console.log('[コールバック] 既存セッションを検出:', { userId: existingSession.user.id });
                router.replace('/(tabs)');
                return;
              }
            } catch (existingSessionError) {
              if (existingSessionError instanceof Error && existingSessionError.message.includes('timeout')) {
                console.warn('[コールバック] 既存セッション確認タイムアウト、setSessionへ進みます');
              } else {
                console.warn('[コールバック] 既存セッション確認失敗、setSessionへ進みます:', existingSessionError);
              }
            }
            const autoSession = await getSessionWithRetry(3, 500);
            if (autoSession?.user) {
              console.log('[コールバック] 自動セッション検出:', { userId: autoSession.user.id });
              router.replace('/(tabs)');
              return;
            }
          }
          console.log('[コールバック] セッションを設定中...');
          // セッションを設定
          try {
            const { error, data: sessionData } = await withTimeout(
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              }),
              30000,
              'setSession'
            );

            if (error) {
              console.error('[コールバック] セッション設定エラー:', error);
              const fallbackSession = await getSessionWithRetry(3, 500);
              if (fallbackSession?.user) {
                console.log('[コールバック] セッション再確認で復帰:', { userId: fallbackSession.user.id });
                router.replace('/(tabs)');
                return;
              }
              setErrorMessage('認証に失敗しました。ログインからやり直してください。');
              router.replace('/(auth)/login');
              return;
            }

            console.log('[コールバック] セッション設定成功:', { userId: sessionData?.user?.id });
            // 認証成功後、メイン画面にリダイレクト
            router.replace('/(tabs)');
          } catch (err) {
            if (err instanceof Error && err.message.includes('timeout')) {
              console.warn('[コールバック] セッション設定タイムアウト、セッション再確認中:', err);
              await waitForAuthEvent(20000);
              const fallbackSession = await getSessionWithRetry(10, 700);
              if (fallbackSession?.user) {
                console.log('[コールバック] タイムアウト後の再確認で復帰:', { userId: fallbackSession.user.id });
                router.replace('/(tabs)');
                return;
              }
              setErrorMessage('認証に時間がかかっています。もう一度お試しください。');
              router.replace('/(auth)/login');
              return;
            }
            throw err;
          }
        } else {
          console.log('[コールバック] トークンが見つからないため、セッションを確認中...');
          // トークンが見つからない場合、セッションを確認
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session && !error) {
            console.log('[コールバック] 既存セッションを確認:', { userId: session.user?.id });
            router.replace('/(tabs)');
          } else {
            console.error('[コールバック] セッションが見つかりません:', error);
            setErrorMessage('認証に失敗しました。ログインからやり直してください。');
            router.replace('/(auth)/login');
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('timeout')) {
          console.error('[コールバック] 処理タイムアウト:', err);
          const fallbackSession = await getSessionWithRetry(5, 700);
          if (fallbackSession?.user) {
            console.log('[コールバック] タイムアウト後の再確認で復帰:', { userId: fallbackSession.user.id });
            router.replace('/(tabs)');
            return;
          }
          setErrorMessage('認証に時間がかかっています。もう一度お試しください。');
          router.replace('/(auth)/login');
          return;
        }
        console.error('[コールバック] 処理エラー:', err);
        setErrorMessage('認証に失敗しました。ログインからやり直してください。');
        router.replace('/(auth)/login');
      } finally {
        isProcessingRef.current = false;
        if (!pendingUrlRef.current && watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }
        if (pendingUrlRef.current) {
          const nextUrl = pendingUrlRef.current;
          pendingUrlRef.current = null;
          console.log('[コールバック] 保留URLを再処理:', { url: nextUrl, platform: Platform.OS });
          processAuthCallback(nextUrl);
        }
      }
    };

    if (paramUrl) {
      console.log('[コールバック] 画面遷移パラメータURLを処理:', { platform: Platform.OS });
      processAuthCallback(paramUrl);
    } else {
      // 初期URLを処理（アプリが閉じている状態から開かれた場合）
      Linking.getInitialURL().then((url) => {
        console.log('[コールバック] getInitialURL結果:', { url, platform: Platform.OS });
        if (url) {
          console.log('[コールバック] 初期URLを処理:', url);
          processAuthCallback(url);
        } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Web環境では常に処理
          console.log('[コールバック] Web環境、URLなしで処理');
          processAuthCallback(null);
        } else {
          // ネイティブ環境でURLがない場合、セッションを確認
          console.log('[コールバック] ネイティブ環境、URLなしでセッション確認');
          processAuthCallback(null);
        }
      }).catch((error) => {
        console.error('[コールバック] getInitialURLエラー:', error);
        // エラー時もセッションを確認
        processAuthCallback(null);
      });
    }

    // 深いリンクのリスナー（アプリが既に開いている状態でリンクが来た場合）
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('[コールバック] Linkingイベント検出:', { url: event.url, platform: Platform.OS });
      processAuthCallback(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [paramUrlRaw, router]);

  return (
    <View style={styles.container}>
      {errorMessage ? (
        <Text style={styles.text}>{errorMessage}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.text}>認証処理中...</Text>
        </>
      )}
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
