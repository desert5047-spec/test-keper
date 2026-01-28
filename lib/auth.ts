import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { Alert, Platform } from "react-native";

export async function signInWithGoogleExpoGo() {
  try {
    // この関数は iOS/Android 専用（Web では呼ばれない）
    if (Platform.OS === 'web') {
      console.error("[Google認証] signInWithGoogleExpoGo はモバイル専用です。Webでは signInWithGoogle を使用してください。");
      return null;
    }

    // redirectUri は常に AuthSession.makeRedirectUri を使用
    const redirectUri = AuthSession.makeRedirectUri({
      path: "auth/callback",
    });

    console.log("[Google認証] redirectUri:", redirectUri);
    console.log("[Google認証] Platform.OS:", Platform.OS);
    console.log("[Google認証] Constants.appOwnership:", Constants.appOwnership);

    // ✅ Supabase にも「この redirectUri へ戻して」と明示する
    // skipBrowserRedirect: true を指定（モバイル専用）
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error("[Google認証] Supabase OAuth エラー:", error);
      Alert.alert("認証エラー", "Google認証の開始に失敗しました。もう一度お試しください。");
      return null;
    }

    if (!data?.url) {
      console.error("[Google認証] OAuth URL が取得できませんでした");
      Alert.alert("認証エラー", "認証URLの取得に失敗しました。もう一度お試しください。");
      return null;
    }

    // ✅ WebBrowser.openAuthSessionAsync を使用（AuthSession.startAsync の代替）
    console.log("[Google認証] OAuth URLを開きます:", data.url);
    console.log("[Google認証] リダイレクトURI:", redirectUri);
    
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    console.log("[Google認証] WebBrowser.openAuthSessionAsync結果:", {
      type: result.type,
      url: result.type === "success" ? result.url : undefined,
    });

    // cancel の場合はユーザーキャンセルとして扱い、アラートに出すだけにしてクラッシュさせない
    if (result.type === "cancel") {
      console.log("[Google認証] ユーザーがキャンセルしました");
      Alert.alert("認証がキャンセルされました", "Google認証がキャンセルされました。もう一度お試しください。");
      return null;
    }

    // success のときだけ URL からトークンを抽出してセッションを設定
    if (result.type === "success" && result.url) {
      try {
        console.log("[Google認証] openAuthSessionAsync成功、URL:", result.url);
        
        // URL文字列から直接ハッシュフラグメントを抽出（Linking.parseがexp://スキームのハッシュを正しくパースしない場合があるため）
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let code: string | null = null;
        
        // ハッシュフラグメント（#以降）を直接抽出
        const hashIndex = result.url.indexOf('#');
        if (hashIndex !== -1) {
          const hashPart = result.url.substring(hashIndex + 1);
          const hashParams = new URLSearchParams(hashPart);
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          code = hashParams.get('code');
          console.log("[Google認証] ハッシュフラグメントから抽出:", { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken, 
            hasCode: !!code 
          });
        }
        
        // ハッシュから取得できなかった場合、Linking.parseを試す
        if (!accessToken && !refreshToken && !code) {
          const parsedUrl = Linking.parse(result.url);
          const queryParams = parsedUrl.queryParams || {};
          const hashParamsFromParse = parsedUrl.hash ? new URLSearchParams(parsedUrl.hash.substring(1)) : null;
          
          accessToken = queryParams.access_token as string | undefined || hashParamsFromParse?.get('access_token') || null;
          refreshToken = queryParams.refresh_token as string | undefined || hashParamsFromParse?.get('refresh_token') || null;
          code = queryParams.code as string | undefined || hashParamsFromParse?.get('code') || null;
          
          console.log("[Google認証] Linking.parseから抽出:", { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken, 
            hasCode: !!code,
            queryParams: Object.keys(queryParams),
            hasHash: !!parsedUrl.hash
          });
        }
        
        console.log("[Google認証] 最終的な抽出結果:", { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken, 
          hasCode: !!code
        });

        // code がある場合は、getSessionFromUrl を試す
        if (code) {
          const callbackUrl = `${redirectUri}?code=${encodeURIComponent(code)}`;
          console.log("[Google認証] コールバックURLを組み立て:", callbackUrl);

          try {
            const { data: sessionData, error: sessionError } = await (supabase.auth as any).getSessionFromUrl({
              url: callbackUrl,
              storeSession: true,
            });

            if (sessionError) {
              console.error("[Google認証] getSessionFromUrlエラー:", sessionError);
              // フォールバック処理に進む
            } else {
              console.log("[Google認証] セッション取得成功:", { userId: sessionData?.session?.user?.id });
              return sessionData?.session || null;
            }
          } catch (getSessionError: any) {
            console.warn("[Google認証] getSessionFromUrlが存在しないため、代替処理を実行:", getSessionError?.message);
          }
        }

        // access_token と refresh_token がある場合は直接セッションを設定
        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("[Google認証] セッション設定エラー:", sessionError);
            Alert.alert("認証エラー", "セッションの設定に失敗しました。もう一度お試しください。");
            return null;
          }

          console.log("[Google認証] セッション設定成功:", { userId: sessionData?.user?.id });
          return sessionData.session;
        }

        // トークンもコードも取得できない場合
        console.error("[Google認証] トークンもコードも取得できませんでした");
        console.error("[Google認証] URL全体:", result.url);
        Alert.alert("認証エラー", "認証情報の取得に失敗しました。もう一度お試しください。");
        return null;
      } catch (parseError: any) {
        console.error("[Google認証] 処理エラー:", parseError);
        console.error("[Google認証] エラー詳細:", parseError.message);
        Alert.alert("認証エラー", "認証情報の処理に失敗しました。もう一度お試しください。");
        return null;
      }
    }

    // その他のエラー（dismiss, error など）
    console.error("[Google認証] 予期しない結果:", result.type);
    Alert.alert("認証エラー", "認証が完了できませんでした。もう一度お試しください。");
    return null;
  } catch (error: any) {
    // 予期しないエラーをキャッチしてクラッシュを防ぐ
    console.error("[Google認証] 予期しないエラー:", error);
    Alert.alert("認証エラー", "予期しないエラーが発生しました。もう一度お試しください。");
    return null;
  }
}
