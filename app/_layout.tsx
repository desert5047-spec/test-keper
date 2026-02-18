import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AuthProvider } from '@/contexts/AuthContext';
import { ChildProvider } from '@/contexts/ChildContext';
import { DateProvider } from '@/contexts/DateContext';
import { isSupabaseConfigured, supabaseConfigError, supabase } from '@/lib/supabase';
import { DebugLabel } from '@/components/DebugLabel';
import { log, warn, error as logError } from '@/lib/logger';

// 本番（!__DEV__）では log/info/debug/warn を無効化。error はクラッシュ情報のため残す
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
}

const debugLog = log;

void SplashScreen.preventAutoHideAsync().catch((error) => {
  warn('[RootLayout] SplashScreen.preventAutoHideAsyncエラー');
});

// 無効なリフレッシュトークンエラーはアプリ側で signOut して処理するため、コンソールの ERROR 表示を抑制
LogBox.ignoreLogs(['Invalid Refresh Token', 'Refresh Token Not Found', 'AuthApiError']);

/** 無効なリフレッシュトークンエラーかどうか（Expo Go 等で未処理の Promise 拒否を拾う用） */
function isInvalidRefreshTokenError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;
  const msg = (reason as { message?: string })?.message ?? '';
  const name = (reason as { name?: string })?.name ?? '';
  return (
    name === 'AuthApiError' ||
    msg.includes('Refresh Token') ||
    msg.includes('refresh_token') ||
    msg.includes('Refresh Token Not Found') ||
    msg.includes('Invalid Refresh Token')
  );
}

export default function RootLayout() {
  try {
    useFrameworkReady();
  } catch (error) {
    logError('[RootLayout] useFrameworkReadyエラー');
  }

  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-SemiBold': Nunito_600SemiBold,
    'Nunito-Bold': Nunito_700Bold,
  });

  // Expo Go 起動時にリフレッシュトークンエラーが未処理で飛ぶ場合、ストレージをクリアしてログイン画面へ
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : {};
    const handler = (event: { reason?: unknown; preventDefault?: () => void }) => {
      if (isInvalidRefreshTokenError(event?.reason)) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        warn('[RootLayout] リフレッシュトークンエラーを検出、ストレージをクリアします');
        supabase.auth.signOut().catch(() => {});
      }
    };
    if (typeof (g as any).addEventListener === 'function') {
      (g as any).addEventListener('unhandledrejection', handler);
      return () => (g as any).removeEventListener('unhandledrejection', handler);
    }
  }, []);

  useEffect(() => {
    try {
      if (fontsLoaded || fontError) {
        debugLog('[RootLayout] フォント読み込み完了、スプラッシュ画面を非表示', { fontsLoaded, fontError: !!fontError, platform: Platform.OS });
        SplashScreen.hideAsync().catch(() => {
          logError('[RootLayout] SplashScreen.hideAsyncエラー');
        });
      }
    } catch (error) {
      logError('[RootLayout] useEffectエラー');
      // エラーが発生してもスプラッシュ画面を非表示にする
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    debugLog('[RootLayout] フォント読み込み中...', { platform: Platform.OS });
    return null;
  }

  if (fontError) {
    logError('[RootLayout] フォント読み込みエラー');
    // フォントエラーがあってもアプリを続行
  }

  if (!isSupabaseConfigured) {
    logError('[RootLayout] Supabase設定がありません');
    return (
      <View style={styles.configErrorContainer}>
        <Text style={styles.configErrorTitle}>設定エラー</Text>
        <Text style={styles.configErrorText}>{supabaseConfigError}</Text>
      </View>
    );
  }

  debugLog('[RootLayout] レンダリング開始', { fontsLoaded, fontError: !!fontError, platform: Platform.OS });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DebugLabel />
      {Platform.OS === 'web' && (
        <style>{`
          button:focus,
          button:focus-visible,
          [role="button"]:focus,
          [role="button"]:focus-visible {
            outline: none !important;
            outline-width: 0 !important;
          }
          button::-moz-focus-inner {
            border: 0 !important;
          }
        `}</style>
      )}
      <AuthProvider>
        <ChildProvider>
          <DateProvider>
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth-callback" />
            <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="consent" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="add" />
              <Stack.Screen name="detail" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="children" />
              <Stack.Screen name="register-child" />
              <Stack.Screen name="privacy-policy" />
              <Stack.Screen name="terms-of-service" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </DateProvider>
        </ChildProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  configErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  configErrorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
  },
  configErrorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    textAlign: 'center',
  },
});
