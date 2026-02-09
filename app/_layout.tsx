import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack, SplashScreen, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ChildProvider } from '@/contexts/ChildContext';
import { DateProvider } from '@/contexts/DateContext';
import { isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { getHandlingAuthCallback, isBootHold } from '@/lib/authCallbackState';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

const DebugHud = ({ initialUrl }: { initialUrl: string | null }) => {
  const pathname = usePathname();
  const { authLoading, sessionUserId } = useAuth();

  if (!__DEV__) return null;

  return (
    <View pointerEvents="none" style={styles.debugHud}>
      <Text style={styles.debugHudText}>path: {pathname || '(none)'}</Text>
      <Text style={styles.debugHudText}>initialURL: {initialUrl ?? '(null)'}</Text>
      <Text style={styles.debugHudText}>authLoading: {String(authLoading)}</Text>
      <Text style={styles.debugHudText}>sessionUserId: {sessionUserId ?? '(none)'}</Text>
      <Text style={styles.debugHudText}>handlingAuthCb: {String(getHandlingAuthCallback())}</Text>
      <Text style={styles.debugHudText}>bootHold: {String(isBootHold())}</Text>
    </View>
  );
};

void SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('[RootLayout] SplashScreen.preventAutoHideAsyncエラー');
});

export default function RootLayout() {
  try {
    useFrameworkReady();
  } catch (error) {
    console.error('[RootLayout] useFrameworkReadyエラー');
  }

  const [initialUrl, setInitialUrl] = useState<string | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-SemiBold': Nunito_600SemiBold,
    'Nunito-Bold': Nunito_700Bold,
  });

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        setInitialUrl(url ?? null);
      })
      .catch(() => {
        setInitialUrl('(error)');
      });
  }, []);

  useEffect(() => {
    try {
      if (fontsLoaded || fontError) {
        debugLog('[RootLayout] フォント読み込み完了、スプラッシュ画面を非表示', { fontsLoaded, fontError: !!fontError, platform: Platform.OS });
        SplashScreen.hideAsync().catch(() => {
          console.error('[RootLayout] SplashScreen.hideAsyncエラー');
        });
      }
    } catch (error) {
      console.error('[RootLayout] useEffectエラー');
      // エラーが発生してもスプラッシュ画面を非表示にする
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    debugLog('[RootLayout] フォント読み込み中...', { platform: Platform.OS });
    return null;
  }

  if (fontError) {
    console.error('[RootLayout] フォント読み込みエラー');
    // フォントエラーがあってもアプリを続行
  }

  if (!isSupabaseConfigured) {
    console.error('[RootLayout] Supabase設定がありません');
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
            <DebugHud initialUrl={initialUrl} />
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
  debugHud: {
    position: 'absolute',
    top: 50,
    right: 12,
    zIndex: 9999,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
  },
  debugHudText: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 13,
  },
});
