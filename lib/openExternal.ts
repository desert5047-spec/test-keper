import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { warn } from '@/lib/logger';

/**
 * 外部URLをブラウザで開く。
 * - Web: window.open
 * - iOS/Android: WebBrowser.openBrowserAsync（in-app browser）
 * TestFlight / 内部テストでも確実にブラウザで開くため、Linking.openURL ではなくこちらを使用する。
 */
export async function openExternal(url: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  } catch {
    warn('[openExternal] URLを開けませんでした');
  }
}
