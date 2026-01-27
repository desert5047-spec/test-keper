import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// OAuthリダイレクト後の処理を完了させる
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  // オンボーディング完了フラグと子供数をチェックして適切な画面にリダイレクト
  const checkAndRedirect = useCallback(async (currentUser: User) => {
    if (checkingOnboarding) return;
    setCheckingOnboarding(true);

    try {
      const onboardingKey = `hasCompletedOnboarding_${currentUser.id}`;
      const hasCompletedOnboarding = await AsyncStorage.getItem(onboardingKey);
      const currentPath = segments.join('/');

      // オンボーディング未完了の場合
      if (!hasCompletedOnboarding) {
        if (currentPath !== 'onboarding') {
          router.replace('/onboarding');
        }
        setCheckingOnboarding(false);
        return;
      }

      // 子供の数をチェック
      const { data: childrenData, error } = await supabase
        .from('children')
        .select('id')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error checking children:', error);
        setCheckingOnboarding(false);
        return;
      }

      const childrenCount = childrenData?.length || 0;

      // 子供が0人の場合、子供登録ページへ
      if (childrenCount === 0) {
        if (currentPath !== 'register-child') {
          router.replace('/register-child');
        }
      } else {
        // 子供がいる場合、オンボーディングや認証グループ内にいる場合はタブページへ
        const inAuthGroup = segments[0] === '(auth)';
        const isOnboarding = currentPath === 'onboarding';
        if ((inAuthGroup || isOnboarding) && currentPath !== '(tabs)') {
          router.replace('/(tabs)');
        }
      }
    } catch (error) {
      console.error('Error in checkAndRedirect:', error);
    } finally {
      setCheckingOnboarding(false);
    }
  }, [checkingOnboarding, segments, router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] 認証状態変更:', { event, userId: session?.user?.id });
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || checkingOnboarding) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = segments[0] === 'onboarding';
    const isRegisterChild = segments[0] === 'register-child';
    const isTabs = segments[0] === '(tabs)';

    // 未ログインの場合
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    // ログイン済みの場合
    if (user) {
      // 認証グループ内にいる場合は、オンボーディング/子供登録チェックを実行
      if (inAuthGroup) {
        checkAndRedirect(user);
      } else if (!isOnboarding && !isRegisterChild && !isTabs) {
        // オンボーディング、子供登録、タブページ以外にいる場合もチェック
        checkAndRedirect(user);
      }
    }
  }, [user, segments, loading, checkingOnboarding, checkAndRedirect]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // メール確認のリダイレクトURLを設定
        emailRedirectTo: Platform.OS === 'web' 
          ? (typeof window !== 'undefined' ? `${window.location.origin}/(auth)/callback` : undefined)
          : undefined,
      },
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  const signInWithGoogle = async () => {
    try {
      // リダイレクトURLを構築
      // Supabase DashboardでこのURLを許可済みリダイレクトURLに追加する必要があります
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      
      if (!supabaseUrl) {
        return { error: new Error('Supabase URLが設定されていません') };
      }

      // iOS/Androidではカスタムスキームを使用
      // Expo Routerでは、ルートグループの括弧は深いリンクでは含まれない
      const customScheme = 'myapp';
      const redirectUrl = Platform.select({
        web: typeof window !== 'undefined' ? `${window.location.origin}/(auth)/callback` : `${supabaseUrl}/auth/v1/callback`,
        ios: `${customScheme}://auth/callback`,
        android: `${customScheme}://auth/callback`,
        default: `${supabaseUrl}/auth/v1/callback`,
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        return { error };
      }

      // Web環境では、ブラウザが自動的にリダイレクトするため、ここで処理終了
      if (Platform.OS === 'web') {
        // Web環境では、リダイレクト後にonAuthStateChangeが自動的に発火する
        return { error: null };
      }

      // ネイティブプラットフォームでは、expo-web-browserでOAuthフローを開く
      if (!data?.url) {
        return { error: new Error('OAuth URLの取得に失敗しました') };
      }

      console.log('[Google認証] OAuth URLを開きます:', data.url);
      console.log('[Google認証] リダイレクトURL:', redirectUrl);

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      console.log('[Google認証] WebBrowser結果:', {
        type: result.type,
        url: result.url,
        errorCode: (result as any).errorCode,
        errorMessage: (result as any).errorMessage,
      });

      if (result.type === 'success' && result.url) {
        try {
          console.log('[Google認証] コールバックURLを受信:', result.url);
          let accessToken: string | null = null;
          let refreshToken: string | null = null;

          // カスタムスキーム（myapp://）のURLを処理
          if (result.url.startsWith('myapp://') || result.url.startsWith('com.googleusercontent.apps.')) {
            console.log('[Google認証] カスタムスキームURLを処理中');
            // expo-linkingでパース
            const parsedUrl = Linking.parse(result.url);
            console.log('[Google認証] パースされたURL:', parsedUrl);
            
            // クエリパラメータからトークンを取得
            if (parsedUrl.queryParams) {
              accessToken = parsedUrl.queryParams.access_token as string || null;
              refreshToken = parsedUrl.queryParams.refresh_token as string || null;
              console.log('[Google認証] クエリパラメータから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
            }
            
            // URL文字列から直接フラグメント（#）を検索（Supabaseのデフォルト形式）
            if (!accessToken && result.url.includes('#')) {
              console.log('[Google認証] フラグメントからトークンを検索中');
              const hashIndex = result.url.indexOf('#');
              const hashPart = result.url.substring(hashIndex + 1);
              const hashParams = new URLSearchParams(hashPart);
              accessToken = hashParams.get('access_token');
              refreshToken = hashParams.get('refresh_token');
              console.log('[Google認証] フラグメントから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
            }
          } else {
            // 通常のHTTP/HTTPS URLの場合
            console.log('[Google認証] HTTP/HTTPS URLを処理中');
            const url = new URL(result.url);
            const hashParams = new URLSearchParams(url.hash.substring(1));
            accessToken = hashParams.get('access_token') || url.searchParams.get('access_token');
            refreshToken = hashParams.get('refresh_token') || url.searchParams.get('refresh_token');
            console.log('[Google認証] URLから取得:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
          }

          if (accessToken && refreshToken) {
            console.log('[Google認証] セッションを設定中...');
            const { error: sessionError, data: sessionData } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('[Google認証] セッション設定エラー:', sessionError);
              return { error: sessionError };
            }
            console.log('[Google認証] セッション設定成功:', { userId: sessionData?.user?.id });
          } else {
            // トークンが見つからない場合、URL全体をSupabaseに処理させる
            // Supabaseは自動的にURLからセッションを復元する
            console.log('[Google認証] トークンが見つからないため、セッションを確認中...');
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
              console.error('[Google認証] セッション取得エラー:', sessionError);
              return { error: sessionError };
            }
            if (session) {
              console.log('[Google認証] 既存セッションを確認:', { userId: session.user?.id });
            } else {
              console.warn('[Google認証] セッションが見つかりませんでした');
            }
          }
        } catch (urlError: any) {
          console.error('[Google認証] URL解析エラー:', urlError);
          // エラーが発生しても、Supabaseが自動的にセッションを復元できる場合がある
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (!session || sessionError) {
            console.error('[Google認証] セッション復元失敗:', sessionError);
            return { error: new Error('認証URLの処理に失敗しました') };
          }
          console.log('[Google認証] エラー後もセッションを確認:', { userId: session.user?.id });
        }
      } else if (result.type === 'cancel') {
        console.log('[Google認証] ユーザーがキャンセルしました');
        return { error: new Error('Google認証がキャンセルされました') };
      } else if (result.type === 'dismiss') {
        // Expo Goでは、深いリンクが動作しない場合、ブラウザが閉じられてdismissになることがある
        // しかし、認証自体は成功している可能性があるため、セッションを確認する
        console.warn('[Google認証] ブラウザが閉じられました（dismiss）。セッションを確認します...');
        
        // onAuthStateChangeイベントを監視してセッションが設定されるのを待つ
        return new Promise((resolve) => {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.warn('[Google認証] ⚠️ タイムアウト: セッションが見つかりませんでした。');
              resolve({ error: new Error('認証が完了しませんでした。もう一度お試しください。') });
            }
          }, 20000); // 20秒でタイムアウト

          // onAuthStateChangeイベントを監視
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[Google認証] onAuthStateChangeイベント:', { event, hasSession: !!session, userId: session?.user?.id });
            
            if (event === 'SIGNED_IN' && session && !resolved) {
              resolved = true;
              clearTimeout(timeout);
              subscription.unsubscribe();
              console.log('[Google認証] ✅ セッションが見つかりました（onAuthStateChange経由）:', { 
                userId: session.user?.id,
                email: session.user?.email 
              });
              resolve({ error: null });
            } else if (event === 'TOKEN_REFRESHED' && session && !resolved) {
              // 既にログイン済みの場合
              resolved = true;
              clearTimeout(timeout);
              subscription.unsubscribe();
              console.log('[Google認証] ✅ セッションが更新されました:', { 
                userId: session.user?.id,
                email: session.user?.email 
              });
              resolve({ error: null });
            }
          });

          // 並行して定期的にセッションを確認（フォールバック）
          let checkCount = 0;
          const maxChecks = 15;
          const checkInterval = setInterval(async () => {
            if (resolved) {
              clearInterval(checkInterval);
              return;
            }

            checkCount++;
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (session && !sessionError && !resolved) {
              resolved = true;
              clearTimeout(timeout);
              clearInterval(checkInterval);
              subscription.unsubscribe();
              console.log('[Google認証] ✅ セッションが見つかりました（定期的な確認）:', { 
                userId: session.user?.id,
                email: session.user?.email,
                attempt: checkCount 
              });
              resolve({ error: null });
            } else if (checkCount >= maxChecks) {
              clearInterval(checkInterval);
              if (!resolved) {
                console.log(`[Google認証] セッション確認試行 ${checkCount}/${maxChecks}...`);
              }
            } else {
              console.log(`[Google認証] セッション確認試行 ${checkCount}/${maxChecks}...`);
            }
          }, 1500);
        });
      } else {
        console.warn('[Google認証] WebBrowser結果が予期しないタイプ:', result);
        // その他の場合もセッションを確認
        console.log('[Google認証] セッションを再確認中（3秒待機後）...');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        for (let i = 0; i < 5; i++) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (session && !sessionError) {
            console.log('[Google認証] セッションが見つかりました（フォールバック）:', { 
              userId: session.user?.id,
              attempt: i + 1 
            });
            return { error: null };
          }
          console.log(`[Google認証] セッション確認試行 ${i + 1}/5...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.error('[Google認証] セッションが見つかりませんでした');
        return { error: new Error('Google認証に失敗しました。セッションを取得できませんでした。') };
      }

      return { error: null };
    } catch (err: any) {
      console.error('Google認証エラー:', err);
      return { error: err instanceof Error ? err : new Error('Google認証中にエラーが発生しました') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  const resetPassword = async (email: string) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      let redirectUrl: string | undefined;

      if (Platform.OS === 'web') {
        redirectUrl = typeof window !== 'undefined' 
          ? `${window.location.origin}/(auth)/reset-password`
          : undefined;
      } else {
        // ネイティブ環境では、deep linkを使用
        const scheme = 'myapp';
        redirectUrl = `${scheme}://reset-password`;
      }

      console.log('[パスワードリセット] リクエスト開始:', { email, redirectUrl, platform: Platform.OS });

      const { error, data } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('[パスワードリセット] Supabaseエラー:', error);
        return { error };
      }

      console.log('[パスワードリセット] 成功:', data);
      // セキュリティ上の理由で、Supabaseは存在しないメールアドレスでもエラーを返さない場合がある
      // そのため、常に成功メッセージを表示する
      return { error: null };
    } catch (err: any) {
      console.error('[パスワードリセット] 予期しないエラー:', err);
      return { error: err instanceof Error ? err : new Error('パスワードリセット中にエラーが発生しました') };
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
