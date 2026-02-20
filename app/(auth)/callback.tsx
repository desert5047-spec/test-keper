import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { log, warn, error as logError } from '@/lib/logger';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { url: paramUrlRaw, access_token, refresh_token, code, type } = useLocalSearchParams();
  const [errorMessage, setErrorMessage] = useState('');
  const isProcessingRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugLog = log;

  useEffect(() => {
    const paramUrl =
      typeof paramUrlRaw === 'string' && paramUrlRaw
        ? decodeURIComponent(paramUrlRaw)
        : null;
    const processAuthCallback = async (url: string | null) => {
      if (isProcessingRef.current) {
        debugLog('[コールバック] 既に処理中のためスキップ');
        pendingUrlRef.current = url;
        return;
      }
      isProcessingRef.current = true;
      if (!watchdogRef.current) {
        watchdogRef.current = setTimeout(async () => {
          warn('[コールバック] 処理監視タイムアウト、セッション再確認中');
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            debugLog('[コールバック] 監視タイムアウト後にセッション検出');
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

        debugLog('[コールバック] 処理開始:', { hasUrl: !!url, platform: Platform.OS });
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let authCode: string | null = null;
        let authType: string | null = null;

        // Web環境でのOAuthコールバック処理
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          debugLog('[コールバック] Web環境で処理中');
          const searchParams = new URLSearchParams(window.location.search);
          authCode = searchParams.get('code');
          authType = searchParams.get('type');
          // URLからハッシュフラグメントを取得
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          debugLog('[コールバック] Webから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
          try {
            window.history.replaceState(null, '', window.location.pathname);
          } catch (historyError) {
            warn('[コールバック] URL履歴のクリアに失敗');
          }
        } else if (url) {
          debugLog('[コールバック] ネイティブ環境でURLを処理中');
          // iOS/Android環境での深いリンク処理
          // カスタムスキーム（myapp://、exp://）のURLを処理
          
          // exp://スキームの場合、URL文字列から直接パラメータを抽出
          if (url.startsWith('exp://')) {
            debugLog('[コールバック] exp://スキーム検出、URL文字列から直接抽出');
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
              debugLog('[コールバック] exp://クエリパラメータから取得:', { 
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
                debugLog('[コールバック] exp://フラグメントから取得:', { 
                  hasCode: !!authCode,
                  hasAccessToken: !!accessToken, 
                  hasRefreshToken: !!refreshToken 
                });
              }
            }
          }
          
          // Linking.parseも試す（フォールバック）
          Linking.parse(url);
          debugLog('[コールバック] パースされたURL取得済み');
          
          // クエリパラメータからトークンを取得（まだ取得できていない場合）
          if (parsedUrl.queryParams && (!accessToken || !authCode)) {
            accessToken = accessToken || (parsedUrl.queryParams.access_token as string) || null;
            refreshToken = refreshToken || (parsedUrl.queryParams.refresh_token as string) || null;
            authCode = authCode || (parsedUrl.queryParams.code as string) || null;
            authType = authType || (parsedUrl.queryParams.type as string) || null;
            debugLog('[コールバック] Linking.parseから取得:', { 
              hasCode: !!authCode,
              hasAccessToken: !!accessToken, 
              hasRefreshToken: !!refreshToken 
            });
          }
          
          // URL文字列から直接フラグメント（#）を検索（Supabaseのデフォルト形式）
          if (!accessToken && url.includes('#')) {
            debugLog('[コールバック] フラグメントからトークンを検索中');
            const hashIndex = url.indexOf('#');
            const hashPart = url.substring(hashIndex + 1);
            if (hashPart.trim()) {
              const hashParams = new URLSearchParams(hashPart);
              accessToken = hashParams.get('access_token') || accessToken;
              refreshToken = hashParams.get('refresh_token') || refreshToken;
              authCode = hashParams.get('code') || authCode;
              debugLog('[コールバック] フラグメントから取得:', { 
                hasCode: !!authCode,
                hasAccessToken: !!accessToken, 
                hasRefreshToken: !!refreshToken 
              });
            }
          }
        } else if (Platform.OS !== 'web') {
          accessToken = typeof access_token === 'string' ? access_token : null;
          refreshToken = typeof refresh_token === 'string' ? refresh_token : null;
          authCode = typeof code === 'string' ? code : null;
          authType = typeof type === 'string' ? type : null;
          debugLog('[コールバック] クエリパラメータから取得:', {
            hasCode: !!authCode,
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            hasType: !!authType,
          });
        } else {
          debugLog('[コールバック] URLがありません。セッションを確認します。');
        }

        const type = authType
          ?? (Platform.OS === 'web' && typeof window !== 'undefined'
            ? new URLSearchParams(window.location.hash.substring(1)).get('type')
            : url
            ? (Linking.parse(url).queryParams?.type as string || null)
            : null);

        if (type === 'recovery' && accessToken) {
          debugLog('[コールバック] パスワードリセットフローを検出');
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
            debugLog('[コールバック] Web: セッションの自動確立を待機中...');
            const gotEvent = await waitForAuthEvent(20000);
            if (!gotEvent) {
              warn('[コールバック] Web: 認証イベント待機がタイムアウト');
            }
            const autoSession = await getSessionWithRetry(30, 1000);
            if (autoSession?.user) {
              debugLog('[コールバック] Web: 自動セッション検出');
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, document.title, '/(tabs)');
              }
              router.replace('/(tabs)');
              return;
            }
            warn('[コールバック] Web: セッション確立に失敗（code_verifier不足の可能性）');
            setErrorMessage('認証に失敗しました。もう一度ログインしてください。');
            router.replace('/(auth)/login');
            return;
          }

          debugLog('[コールバック] 認可コードを検出、セッション交換中...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (error) {
          logError('[コールバック] セッション交換エラー');
            setErrorMessage('認証に失敗しました。もう一度お試しください。');
            router.replace('/(auth)/login');
            return;
          }
          debugLog('[コールバック] セッション交換成功');
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
                debugLog('[コールバック] 既存セッションを検出');
                router.replace('/(tabs)');
                return;
              }
            } catch (existingSessionError) {
              if (existingSessionError instanceof Error && existingSessionError.message.includes('timeout')) {
                warn('[コールバック] 既存セッション確認タイムアウト、setSessionへ進みます');
              } else {
                warn('[コールバック] 既存セッション確認失敗、setSessionへ進みます');
              }
            }
            const autoSession = await getSessionWithRetry(3, 500);
            if (autoSession?.user) {
              debugLog('[コールバック] 自動セッション検出');
              router.replace('/(tabs)');
              return;
            }
          }
          debugLog('[コールバック] セッションを設定中...');
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
            logError('[コールバック] セッション設定エラー');
              const fallbackSession = await getSessionWithRetry(3, 500);
              if (fallbackSession?.user) {
                debugLog('[コールバック] セッション再確認で復帰');
                router.replace('/(tabs)');
                return;
              }
              setErrorMessage('認証に失敗しました。ログインからやり直してください。');
              router.replace('/(auth)/login');
              return;
            }

            debugLog('[コールバック] セッション設定成功');
            // 認証成功後、メイン画面にリダイレクト
            router.replace('/(tabs)');
          } catch (err) {
            if (err instanceof Error && err.message.includes('timeout')) {
              warn('[コールバック] セッション設定タイムアウト、セッション再確認中');
              await waitForAuthEvent(20000);
              const fallbackSession = await getSessionWithRetry(10, 700);
              if (fallbackSession?.user) {
                debugLog('[コールバック] タイムアウト後の再確認で復帰');
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
          debugLog('[コールバック] トークンが見つからないため、セッションを確認中...');
          // トークンが見つからない場合、セッションを確認
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session && !error) {
            debugLog('[コールバック] 既存セッションを確認');
            router.replace('/(tabs)');
          } else {
            logError('[コールバック] セッションが見つかりません');
            setErrorMessage('認証に失敗しました。ログインからやり直してください。');
            router.replace('/(auth)/login');
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('timeout')) {
          logError('[コールバック] 処理タイムアウト');
          const fallbackSession = await getSessionWithRetry(5, 700);
          if (fallbackSession?.user) {
            debugLog('[コールバック] タイムアウト後の再確認で復帰');
            router.replace('/(tabs)');
            return;
          }
          setErrorMessage('認証に時間がかかっています。もう一度お試しください。');
          router.replace('/(auth)/login');
          return;
        }
        logError('[コールバック] 処理エラー');
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
          debugLog('[コールバック] 保留URLを再処理:', { platform: Platform.OS });
          processAuthCallback(nextUrl);
        }
      }
    };

    if (paramUrl) {
      debugLog('[コールバック] 画面遷移パラメータURLを処理:', { platform: Platform.OS });
      processAuthCallback(paramUrl);
    } else {
      // 初期URLを処理（アプリが閉じている状態から開かれた場合）
      Linking.getInitialURL().then((url) => {
        debugLog('[コールバック] getInitialURL結果:', { hasUrl: !!url, platform: Platform.OS });
        if (url) {
          debugLog('[コールバック] 初期URLを処理');
          processAuthCallback(url);
        } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Web環境では常に処理
          debugLog('[コールバック] Web環境、URLなしで処理');
          processAuthCallback(null);
        } else {
          // ネイティブ環境でURLがない場合、セッションを確認
          debugLog('[コールバック] ネイティブ環境、URLなしでセッション確認');
          processAuthCallback(null);
        }
      }).catch((error) => {
        logError('[コールバック] getInitialURLエラー');
        // エラー時もセッションを確認
        processAuthCallback(null);
      });
    }

    // 深いリンクのリスナー（アプリが既に開いている状態でリンクが来た場合）
    const subscription = Linking.addEventListener('url', (event) => {
      debugLog('[コールバック] Linkingイベント検出:', { hasUrl: !!event.url, platform: Platform.OS });
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
