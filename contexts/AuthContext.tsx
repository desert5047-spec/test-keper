import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
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
        // 子供がいる場合、認証グループ内にいる場合はタブページへ
        const inAuthGroup = segments[0] === '(auth)';
        if (inAuthGroup && currentPath !== '(tabs)') {
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

      const redirectUrl = Platform.select({
        web: typeof window !== 'undefined' ? `${window.location.origin}/(auth)/callback` : `${supabaseUrl}/auth/v1/callback`,
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

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success' && result.url) {
        try {
          // リダイレクトURLからフラグメントまたはクエリパラメータを抽出
          const url = new URL(result.url);
          
          // URLフラグメント（#）からトークンを取得（Supabaseのデフォルト形式）
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = hashParams.get('access_token') || url.searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || url.searchParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              return { error: sessionError };
            }
          } else {
            // トークンが見つからない場合、URL全体をSupabaseに処理させる
            // Supabaseは自動的にURLからセッションを復元する
            const { error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
              return { error: sessionError };
            }
          }
        } catch (urlError: any) {
          console.error('URL解析エラー:', urlError);
          return { error: new Error('認証URLの処理に失敗しました') };
        }
      } else if (result.type === 'cancel') {
        return { error: new Error('Google認証がキャンセルされました') };
      } else {
        return { error: new Error('Google認証に失敗しました') };
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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
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
