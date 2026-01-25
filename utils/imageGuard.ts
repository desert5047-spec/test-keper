import { Platform } from 'react-native';

export function validateImageUri(uri: string | null): void {
  if (!uri) return;

  // Web環境ではblob: URLは正常
  if (uri.startsWith('blob:')) {
    if (Platform.OS === 'web') {
      console.log('[画像検証] Web環境のblob URLを許可:', uri.substring(0, 50));
      return;
    }

    if (__DEV__) {
      throw new Error(
        `[画像エラー] blob: URL が検出されました。Expo Go では blob: URI は使えません。file:// または content:// を使用してください。URI: ${uri}`
      );
    }
    throw new Error('画像の読み込みに失敗しました。もう一度選択してください。');
  }
}

export function isValidImageUri(uri: string | null): boolean {
  if (!uri) return false;

  // Web環境ではblob: URLも有効
  if (Platform.OS === 'web' && uri.startsWith('blob:')) {
    return true;
  }

  // data: URLも許可（Webで使用される可能性がある）
  if (Platform.OS === 'web' && uri.startsWith('data:image/')) {
    return true;
  }

  return uri.startsWith('file://') ||
         uri.startsWith('content://') ||
         uri.startsWith('http://') ||
         uri.startsWith('https://');
}
