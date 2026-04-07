import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AuthProvider } from '@/contexts/AuthContext';
import { ChildProvider } from '@/contexts/ChildContext';
import { DateProvider } from '@/contexts/DateContext';
import { isSupabaseConfigured, supabaseConfigError, supabase } from '@/lib/supabase';
import DebugLabel from '@/components/DebugLabel';
import { log, warn, error as logError } from '@/lib/logger';

// ログを無効化（console.error はクラッシュ情報用に維持）
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = () => {};

const debugLog = log;

const isExpoGo = (Constants as any).appOwnership === 'expo';
const shouldManageNativeSplash = Platform.OS !== 'web' && !isExpoGo;

if (shouldManageNativeSplash) {
  void SplashScreen.preventAutoHideAsync().catch(() => {
    warn('[RootLayout] SplashScreen.preventAutoHideAsyncエラー');
  });
}

// 無効なリフレッシュトークンエラーはアプリ側で signOut して処理するため、コンソールの ERROR 表示を抑制
LogBox.ignoreLogs(['Invalid Refresh Token', 'Refresh Token Not Found', 'AuthApiError']);

if (__DEV__) {
  LogBox.ignoreAllLogs(true);
}

const BG = '#FFFFFF';
const STATUS_BAR_OFFSET = 4;

/**
 * [1] StatusBar / Stack / SafeArea 構成（__DEV__デバッグ用メモ）
 *
 * StatusBar 制御:
 *   - setTranslucent / setBackgroundColor: なし（削除済み）
 *   - <StatusBar style="dark" backgroundColor="#fff" /> (expo-status-bar, web以外)
 *   - app.config: androidStatusBar 未指定（デフォルト＝translucent の可能性あり）
 *
 * Stack: screenOptions={{ headerShown: false }}（各画面が独自ヘッダー）
 * SafeAreaProvider: 使用（react-native-safe-area-context）
 * TopSafeAreaBg: insets.top - 4 の高さで画面上部に白背景オーバーレイ
 */

function TopSafeAreaBg() {
  const insets = useSafeAreaInsets();
  const h = Math.max(insets.top - STATUS_BAR_OFFSET, 0);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: h,
        backgroundColor: BG,
        zIndex: 9998,
      }}
    />
  );
}

function DebugInsets() {
  const insets = useSafeAreaInsets();
  const hasLoggedRef = React.useRef(false);

  useEffect(() => {
    if (hasLoggedRef.current) return;
    hasLoggedRef.current = true;
    console.log('[ROOT][Insets]', insets);
  }, [insets]);

  return null;
}

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
    if (__DEV__) {
      console.error('[RootLayout] useFrameworkReadyエラー', error);
    } else {
      console.warn('[RootLayout] framework init failed');
    }
    // 本番では絶対に throw しない
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
    if (Platform.OS !== 'android') return;

    // Android 3ボタン: ナビゲーションバーがコンテンツに被らないようにする
    NavigationBar.setPositionAsync('relative').catch(() => {});
    NavigationBar.setBackgroundColorAsync('#FFFFFF').catch(() => {});
    NavigationBar.setButtonStyleAsync('dark').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if ((fontsLoaded || fontError) && shouldManageNativeSplash) {
        debugLog('[RootLayout] フォント読み込み完了、スプラッシュ画面を非表示', { fontsLoaded, fontError: !!fontError, platform: Platform.OS });
        SplashScreen.hideAsync().catch(() => {
          // Expo Go 等ではネイティブスプラッシュ未登録のため握りつぶす
        });
      }
    } catch (error) {
      logError('[RootLayout] useEffectエラー');
      // エラーが発生してもスプラッシュ画面を非表示にする
      if (shouldManageNativeSplash) {
        SplashScreen.hideAsync().catch(() => {});
      }
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: BG }}>
        <TopSafeAreaBg />
        <DebugInsets />
        {Platform.OS !== 'web' && <StatusBar style="dark" translucent={false} backgroundColor="#fff" />}
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
              <Stack.Screen name="detail" />
              <Stack.Screen name="add" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="children" />
              <Stack.Screen name="register-child" />
              <Stack.Screen name="privacy-policy" />
              <Stack.Screen name="terms-of-service" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </DateProvider>
        </ChildProvider>
      </AuthProvider>
      </SafeAreaProvider>
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
