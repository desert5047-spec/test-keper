import { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AuthProvider } from '@/contexts/AuthContext';
import { ChildProvider } from '@/contexts/ChildContext';
import { DateProvider } from '@/contexts/DateContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  try {
    useFrameworkReady();
  } catch (error) {
    console.error('[RootLayout] useFrameworkReadyエラー:', error);
  }

  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-SemiBold': Nunito_600SemiBold,
    'Nunito-Bold': Nunito_700Bold,
  });

  useEffect(() => {
    try {
      if (fontsLoaded || fontError) {
        console.log('[RootLayout] フォント読み込み完了、スプラッシュ画面を非表示', { fontsLoaded, fontError: !!fontError, platform: Platform.OS });
        SplashScreen.hideAsync().catch((error) => {
          console.error('[RootLayout] SplashScreen.hideAsyncエラー:', error);
        });
      }
    } catch (error) {
      console.error('[RootLayout] useEffectエラー:', error);
      // エラーが発生してもスプラッシュ画面を非表示にする
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    console.log('[RootLayout] フォント読み込み中...', { platform: Platform.OS });
    return null;
  }

  if (fontError) {
    console.error('[RootLayout] フォント読み込みエラー:', fontError);
    // フォントエラーがあってもアプリを続行
  }

  console.log('[RootLayout] レンダリング開始', { fontsLoaded, fontError: !!fontError, platform: Platform.OS });

  return (
    <>
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
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" />
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
    </>
  );
}
