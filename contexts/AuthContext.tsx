import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, useSegments } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTrackLastAuthProvider } from '@/hooks/useTrackLastAuthProvider';
import { saveLastAuthProvider } from '@/lib/auth/lastProvider';

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
  console.log('[AuthProvider] 初期化開始', { platform: Platform.OS });
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  
  // 前回のログイン手段を追跡
  useTrackLastAuthProvider();
  
  console.log('[AuthProvider] 状態初期化完了', { 
    hasRouter: !!router, 
    segmentsCount: segments.length,
    platform: Platform.OS 
  });

  // オンボーディング完了フラグと子供数をチェックして適切な画面にリダイレクト
  const checkAndRedirect = useCallback(async (currentUser: User) => {
    if (checkingOnboarding) {
      console.log('[AuthContext] checkAndRedirect: 既にチェック中です');
      return;
    }
    setCheckingOnboarding(true);

    try {
      const currentPath = segments.join('/');
      const onboardingKey = `hasCompletedOnboarding_${currentUser.id}`;
      const hasCompletedOnboarding = await AsyncStorage.getItem(onboardingKey);
      console.log('[AuthContext] checkAndRedirect: オンボーディング完了状態:', { hasCompletedOnboarding, userId: currentUser.id, currentPath });

      // 子供の数をチェック
      const { data: childrenData, error } = await supabase
        .from('children')
        .select('id')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('[AuthContext] checkAndRedirect: 子供データ取得エラー:', error);
        setCheckingOnboarding(false);
        return;
      }

      const childrenCount = childrenData?.length || 0;
      console.log('[AuthContext] checkAndRedirect: 子供の数:', childrenCount);

      // 子供がいる場合、オンボーディングは完了しているとみなす（子供を登録するにはオンボーディングを完了している必要があるため）
      if (childrenCount > 0) {
        // オンボーディング完了フラグが設定されていない場合は設定する
        if (!hasCompletedOnboarding) {
          console.log('[AuthContext] checkAndRedirect: 子供がいるがオンボーディングフラグがないため、フラグを設定します');
          await AsyncStorage.setItem(onboardingKey, 'true');
        }
        
        const isTabs = segments[0] === '(tabs)';
        const inAuthGroup = segments[0] === '(auth)';
        const isOnboarding = currentPath === 'onboarding';
        const isRegisterChild = currentPath === 'register-child';
        
        // オンボーディングページ、認証グループ、子供登録ページにいる場合はタブページへリダイレクト
        if (isOnboarding || inAuthGroup || isRegisterChild) {
          console.log('[AuthContext] checkAndRedirect: 子供がいる、タブページへ');
          router.replace('/(tabs)');
        } else if (!isTabs) {
          // タブページ以外（settings, children, detail, addなど）にいる場合はリダイレクトしない
          console.log('[AuthContext] checkAndRedirect: 既に適切なページにいます:', currentPath);
        }
        setCheckingOnboarding(false);
        return;
      }

      // オンボーディング未完了の場合
      if (!hasCompletedOnboarding) {
        if (currentPath !== 'onboarding') {
          console.log('[AuthContext] checkAndRedirect: オンボーディング未完了、オンボーディングページへ');
          router.replace('/onboarding');
        }
        setCheckingOnboarding(false);
        return;
      }

      // オンボーディング完了だが子供が0人の場合、子供登録ページへ
      if (childrenCount === 0) {
        if (currentPath !== 'register-child') {
          console.log('[AuthContext] checkAndRedirect: 子供が0人、子供登録ページへ');
          router.replace('/register-child');
        }
      }
    } catch (error) {
      console.error('[AuthContext] checkAndRedirect: エラー:', error);
    } finally {
      setCheckingOnboarding(false);
    }
  }, [checkingOnboarding, router, segments]);

  // checkAndRedirectの最新の参照を保持するためのref
  const checkAndRedirectRef = useRef(checkAndRedirect);
  useEffect(() => {
    checkAndRedirectRef.current = checkAndRedirect;
  }, [checkAndRedirect]);

  useEffect(() => {
    console.log('[AuthContext] セッション取得開始', { platform: Platform.OS });
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[AuthContext] セッション取得エラー:', error);
        setLoading(false);
        return;
      }
      console.log('[AuthContext] セッション取得完了', { 
        hasSession: !!session,
        hasUser: !!session?.user,
        platform: Platform.OS 
      });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('[AuthContext] セッション取得例外:', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] 認証状態変更:', { event, userId: session?.user?.id, platform: Platform.OS });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // INITIAL_SESSIONイベントの場合は、getSession()の結果を待つため、loadingをfalseにしない
      // 他のイベントの場合は、loadingをfalseにする
      if (event !== 'INITIAL_SESSION') {
        setLoading(false);
      }
      
      // SIGNED_INイベントの場合は、オンボーディング/子供登録チェックを実行
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[AuthContext] ログイン検出、オンボーディングチェックを実行', { platform: Platform.OS, userId: session.user.id });
        setLoading(false);
        // 少し遅延を入れて、segmentsが更新されるのを待つ
        setTimeout(() => {
          checkAndRedirectRef.current(session.user);
        }, 200);
      }
      
      // SIGNED_OUTイベントの場合は、ログイン画面にリダイレクト
      if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] ログアウト検出、ログイン画面にリダイレクト', { platform: Platform.OS });
        setLoading(false);
        // Androidでは、より確実にリダイレクトするため、少し長めの遅延を入れる
        const delay = Platform.OS === 'android' ? 300 : 100;
        setTimeout(() => {
          console.log('[AuthContext] リダイレクト実行:', { platform: Platform.OS });
          router.replace('/(auth)/login');
        }, delay);
      }
      
      // INITIAL_SESSIONイベントの場合は、getSession()の結果を待つ
      // getSession()が完了したら、loadingをfalseにする
      if (event === 'INITIAL_SESSION') {
        // getSession()の結果を待つ（既に実行されているが、念のため）
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
          console.log('[AuthContext] INITIAL_SESSION処理完了:', { 
            hasUser: !!currentSession?.user,
            platform: Platform.OS 
          });
        });
      }
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

    // メール認証でログインした場合は明示的に保存する
    await saveLastAuthProvider('email');
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

  // Web専用のGoogle認証関数
  // iOS/Androidでは signInWithGoogleExpoGo() を使用すること
  const signInWithGoogle = async () => {
    try {
      // Web専用の処理
      if (Platform.OS !== 'web') {
        console.error('[Google認証] signInWithGoogle はWeb専用です。モバイルでは signInWithGoogleExpoGo を使用してください。');
        return { error: new Error('この関数はWeb専用です') };
      }

      // リダイレクトURLを構築
      // Supabase DashboardでこのURLを許可済みリダイレクトURLに追加する必要があります
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      
      if (!supabaseUrl) {
        return { error: new Error('Supabase URLが設定されていません') };
      }

      // Web環境では window.location.origin を使用
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/(auth)/callback` 
        : `${supabaseUrl}/auth/v1/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false, // Web環境では false（ブラウザが自動的にリダイレクト）
        },
      });

      if (error) {
        return { error };
      }

      // Web環境では、ブラウザが自動的にリダイレクトするため、ここで処理終了
      // リダイレクト後にonAuthStateChangeが自動的に発火する
      return { error: null };
    } catch (err: any) {
      console.error('Google認証エラー:', err);
      return { error: err instanceof Error ? err : new Error('Google認証中にエラーが発生しました') };
    }
  };

  const signOut = async () => {
    try {
      console.log('[AuthContext] ログアウト開始');
      
      // まず、ローカルの状態をクリア
      setSession(null);
      setUser(null);
      
      // SupabaseのsignOutを試みる（エラーが発生しても続行）
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn('[AuthContext] Supabase signOutエラー（無視して続行）:', error);
          // AuthSessionMissingError などのエラーは無視して続行
        } else {
          console.log('[AuthContext] Supabase signOut成功');
        }
      } catch (signOutError: any) {
        // AuthSessionMissingError などのエラーは無視して続行
        console.warn('[AuthContext] Supabase signOut例外（無視して続行）:', signOutError?.message || signOutError);
      }
      
      // ストレージのクリア
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Web環境では、セッションストレージもクリア
        try {
          // Supabaseのセッション関連のストレージをクリア
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          if (supabaseUrl) {
            const projectId = supabaseUrl.split('//')[1]?.split('.')[0];
            if (projectId) {
              localStorage.removeItem(`sb-${projectId}-auth-token`);
            }
          }
          
          // その他のSupabase関連のストレージもクリア
          Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase') || key.includes('sb-') || key.startsWith('supabase.')) {
              localStorage.removeItem(key);
            }
          });
          
          // sessionStorageもクリア
          try {
            sessionStorage.clear();
          } catch (e) {
            // sessionStorageが使えない環境では無視
          }
        } catch (storageError) {
          console.warn('[AuthContext] Webストレージクリアエラー:', storageError);
        }
      } else {
        // Android/iOS環境では、AsyncStorageをクリア
        try {
          // オンボーディング関連のキーをクリア
          const allKeys = await AsyncStorage.getAllKeys();
          const supabaseKeys = allKeys.filter(key => 
            key.includes('supabase') || 
            key.includes('sb-') || 
            key.startsWith('supabase.') ||
            key.startsWith('hasCompletedOnboarding')
          );
          
          if (supabaseKeys.length > 0) {
            await AsyncStorage.multiRemove(supabaseKeys);
            console.log('[AuthContext] AsyncStorageから削除:', supabaseKeys);
          }
          
          // ユーザーIDに関連するオンボーディングキーも削除
          if (user?.id) {
            const onboardingKey = `hasCompletedOnboarding_${user.id}`;
            await AsyncStorage.removeItem(onboardingKey);
          }
        } catch (storageError) {
          console.warn('[AuthContext] AsyncStorageクリアエラー:', storageError);
        }
      }
      
      console.log('[AuthContext] ログアウト処理完了、ログイン画面にリダイレクト', { platform: Platform.OS });
      
      // ログイン画面にリダイレクト
      // Web環境では、window.locationを使う方が確実
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // 少し遅延を入れて、状態更新と認証プロバイダー情報の削除を確実にする
        setTimeout(() => {
          console.log('[AuthContext] ログイン画面にリダイレクト実行', { platform: Platform.OS });
          window.location.href = '/(auth)/login';
        }, 200);
      } else {
        // Android/iOS環境では、router.replaceを使用
        // Androidでは、より確実にリダイレクトするため、少し長めの遅延を入れる
        const delay = Platform.OS === 'android' ? 300 : 100;
        setTimeout(() => {
          console.log('[AuthContext] Android/iOSリダイレクト実行:', { platform: Platform.OS });
          // Androidでは、複数回試行する
          if (Platform.OS === 'android') {
            router.replace('/(auth)/login');
            // 念のため、もう一度試行
            setTimeout(() => {
              router.replace('/(auth)/login');
            }, 200);
          } else {
            router.replace('/(auth)/login');
          }
        }, delay);
      }
    } catch (error) {
      console.error('[AuthContext] ログアウト処理中に予期しないエラー:', error);
      // エラーが発生しても、ローカルの状態をクリアしてリダイレクト
      setSession(null);
      setUser(null);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/(auth)/login';
      } else {
        router.replace('/(auth)/login');
      }
    }
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
