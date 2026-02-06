import { useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { saveLastAuthProvider } from '@/lib/auth/lastProvider';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

/**
 * Supabase Auth の状態変更を監視し、最後の認証プロバイダーを自動保存するhook
 * 
 * 動作:
 * - SIGNED_IN または TOKEN_REFRESHED イベントで、ユーザーの認証プロバイダーを保存
 * - SIGNED_OUT イベントでは削除しない（明示的クリアのみ）
 */
export function useTrackLastAuthProvider() {
  useEffect(() => {
    debugLog('[認証手段] hook初期化');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      debugLog('[認証手段] イベント検出:', { event, hasUser: !!session?.user });
      
      // INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED のいずれでも認証プロバイダーを保存
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          debugLog('[認証手段] ログイン検出、処理開始');
          await handleSignedIn(session.user);
        } else {
          debugLog('[認証手段] セッションにユーザーが存在しません');
        }
      } else if (event === 'SIGNED_OUT') {
        debugLog('[認証手段] ログアウト検出（削除は行いません）');
      }
    });

    return () => {
      debugLog('[認証手段] hookクリーンアップ');
      subscription.unsubscribe();
    };
  }, []);
}

/**
 * ログイン時の処理：ユーザーの認証プロバイダーを判定して保存
 */
async function handleSignedIn(user: User) {
  try {
    // Supabase Auth の認証プロバイダーを判定
    // 1. user.identities 配列から最新の認証プロバイダーを取得（推奨）
    // 2. user.app_metadata.provider から取得
    // 3. デフォルトは 'email'
    
    let authProvider: 'google' | 'email' = 'email'; // デフォルトはemail
    
    // user.identities から認証プロバイダーを取得（最も確実）
    if (user.identities && user.identities.length > 0) {
      // 最新のidentity（最後に追加されたもの）を使用
      const latestIdentity = user.identities[user.identities.length - 1];
      const provider = latestIdentity?.provider;
      
      if (provider === 'google') {
        authProvider = 'google';
      } else if (provider === 'email') {
        authProvider = 'email';
      }
    }
    
    // identities から取得できない場合、app_metadata から取得を試みる
    if (authProvider === 'email') {
      const appMetadataProvider = user.app_metadata?.provider as string | undefined;
      if (appMetadataProvider === 'google') {
        authProvider = 'google';
      }
    }
    
    debugLog('[認証手段] 判定:', { result: authProvider });
    
    await saveLastAuthProvider(authProvider);
  } catch (error) {
    console.error('[認証手段] 保存エラー');
  }
}

