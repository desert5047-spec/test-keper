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
      return { session: null, url: null };
    }

    // redirectUri は常に AuthSession.makeRedirectUri を使用
    const redirectUri = AuthSession.makeRedirectUri({
      path: "callback",
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
      return { session: null, url: null };
    }

    if (!data?.url) {
      console.error("[Google認証] OAuth URL が取得できませんでした");
      Alert.alert("認証エラー", "認証URLの取得に失敗しました。もう一度お試しください。");
      return { session: null, url: null };
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
      return { session: null, url: null };
    }

    // success のときだけ URL からトークンを抽出してセッションを設定
    if (result.type === "success" && result.url) {
      // ネイティブは callback 画面に委譲（この関数内で外部URLは開かない）
      if (Platform.OS !== 'web') {
        return { session: null, url: result.url };
      }
      const openCallbackUrl = async (reason: string) => {
        try {
          console.log("[Google認証] callback URL を開いて処理を委譲します", { reason });
          await Linking.openURL(result.url);
        } catch (openError: any) {
          console.warn("[Google認証] callback URL を開けませんでした:", openError);
        }
      };
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
          hasCode: !!code,
          accessTokenLength: accessToken?.length ?? 0,
          refreshTokenLength: refreshToken?.length ?? 0,
          accessTokenValue: accessToken ? `${accessToken.substring(0, 20)}...` : null,
          refreshTokenValue: refreshToken ? `${refreshToken.substring(0, 20)}...` : null,
        });
        
        // トークンが取得できたか確認
        if (!accessToken || !refreshToken) {
          console.warn("[Google認証] トークンが不完全:", { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken,
            accessTokenLength: accessToken?.length ?? 0,
            refreshTokenLength: refreshToken?.length ?? 0,
          });
          // トークンが不完全な場合は、callback.tsxで処理される可能性があるため、nullを返す
          console.log("[Google認証] callback.tsxでの処理を待ちます");
          await openCallbackUrl("token_incomplete");
          return { session: null, url: result.url };
        }

        // code がある場合は、exchangeCodeForSession を使用
        if (code) {
          console.log("[Google認証] 認可コードを検出、セッション交換中...");
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

            if (sessionError) {
              console.error("[Google認証] exchangeCodeForSessionエラー:", sessionError);
              // エラーをログに記録するが、フォールバック処理に進む
              // callback.tsx で処理される可能性があるため、ここではエラーを投げない
              console.warn("[Google認証] セッション交換失敗、callback.tsxでの処理を待ちます");
              // callback.tsx で処理されるように、URLをそのまま返す
              await openCallbackUrl("exchange_failed");
              return { session: null, url: result.url };
            } else {
              console.log("[Google認証] セッション交換成功:", { userId: sessionData?.session?.user?.id });
              return { session: sessionData?.session || null, url: result.url };
            }
          } catch (exchangeError: any) {
            console.error("[Google認証] exchangeCodeForSession例外:", exchangeError);
            // callback.tsx で処理される可能性があるため、エラーを投げない
            console.warn("[Google認証] セッション交換例外、callback.tsxでの処理を待ちます");
            await openCallbackUrl("exchange_exception");
            return { session: null, url: result.url };
          }
        }

        // access_token と refresh_token がある場合は callback.tsx に処理を委譲（ネイティブ）
        console.log("[Google認証] セッション設定チェック", { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken,
          accessTokenType: typeof accessToken,
          refreshTokenType: typeof refreshToken,
        });
        if (accessToken && refreshToken) {
          if (Platform.OS !== 'web') {
            console.log("[Google認証] ネイティブはcallbackに委譲", { platform: Platform.OS });
            await openCallbackUrl("handoff_native_callback");
            return { session: null, url: result.url };
          }

          console.log("[Google認証] セッション設定開始", { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken,
            accessTokenPrefix: accessToken.substring(0, 20),
            refreshTokenPrefix: refreshToken.substring(0, 20),
          });
          try {
            const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
            const getSessionWithRetry = async (attempts = 10, delayMs = 1000) => {
              for (let i = 0; i < attempts; i += 1) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) return session;
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
                  if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                    clearTimeout(timeoutId);
                    subscription?.unsubscribe();
                    resolve(true);
                  }
                });
                const subscription = data?.subscription;
              });
            };

            // setSessionは完了まで時間がかかることがあるため、十分な猶予を与える
            const setSessionPromise = supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            const timeoutMs = 30000;
            const setSessionResult = await Promise.race([
              setSessionPromise,
              wait(timeoutMs).then(() => null),
            ]) as { data: any; error: any } | null;

            if (setSessionResult === null) {
              console.warn("[Google認証] setSessionタイムアウト、セッションを確認中...", { timeoutMs });
              await waitForAuthEvent(20000);
              const timeoutSession = await getSessionWithRetry(20, 1000);
              if (timeoutSession?.user) {
                console.log("[Google認証] タイムアウト後: セッション確認成功", { userId: timeoutSession.user.id });
                return timeoutSession;
              }
              console.warn("[Google認証] タイムアウト後もセッション未確立、callback.tsxでの処理を待ちます");
              await openCallbackUrl("setSession_timeout");
              return { session: null, url: result.url };
            }

            const { data: sessionData, error: sessionError } = setSessionResult;

            if (sessionError) {
              console.error("[Google認証] セッション設定エラー:", sessionError);
              // エラー時もセッションを確認してみる
              const fallbackSession = await getSessionWithRetry(8, 800);
              if (fallbackSession?.user) {
                console.log("[Google認証] フォールバック: セッション確認成功", { userId: fallbackSession.user.id });
                return { session: fallbackSession, url: result.url };
              }
              Alert.alert("認証エラー", "セッションの設定に失敗しました。もう一度お試しください。");
              return { session: null, url: result.url };
            }

            console.log("[Google認証] セッション設定成功:", { userId: sessionData?.user?.id });
            // セッションが確立されるまで少し待つ
            await new Promise(resolve => setTimeout(resolve, 300));
            // onAuthStateChangeが発火するのを待つ
            console.log("[Google認証] セッション設定完了、onAuthStateChangeを待機中...");
            // セッションが確立されたことを確認
            const { data: { session: verifiedSession } } = await supabase.auth.getSession();
            if (verifiedSession?.user) {
              console.log("[Google認証] セッション確認成功:", { userId: verifiedSession.user.id });
              return { session: verifiedSession, url: result.url };
            } else {
              console.warn("[Google認証] セッション確認失敗、callback.tsxでの処理を待ちます");
              console.log("[Google認証] callback.tsxでの処理を待機中...");
              await openCallbackUrl("session_verify_failed");
              return { session: null, url: result.url };
            }
          } catch (setSessionError: any) {
            console.error("[Google認証] セッション設定例外:", setSessionError);
            Alert.alert("認証エラー", "セッションの設定中にエラーが発生しました。もう一度お試しください。");
            return { session: null, url: result.url };
          }
        }

        // トークンもコードも取得できない場合
        // callback.tsx で処理される可能性があるため、エラーを表示しない
        console.warn("[Google認証] トークンもコードも取得できませんでした");
        console.log("[Google認証] URL全体:", result.url);
        console.log("[Google認証] callback.tsxでの処理を待ちます");
        await openCallbackUrl("no_tokens");
        return { session: null, url: result.url };
      } catch (parseError: any) {
        console.error("[Google認証] 処理エラー:", parseError);
        console.error("[Google認証] エラー詳細:", parseError.message);
        Alert.alert("認証エラー", "認証情報の処理に失敗しました。もう一度お試しください。");
        return { session: null, url: result.url };
      }
    }

    // その他のエラー（dismiss, error など）
    console.error("[Google認証] 予期しない結果:", result.type);
    Alert.alert("認証エラー", "認証が完了できませんでした。もう一度お試しください。");
    return { session: null, url: null };
  } catch (error: any) {
    // 予期しないエラーをキャッチしてクラッシュを防ぐ
    console.error("[Google認証] 予期しないエラー:", error);
    Alert.alert("認証エラー", "予期しないエラーが発生しました。もう一度お試しください。");
    return { session: null, url: null };
  }
}
