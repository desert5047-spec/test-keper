import { Platform } from 'react-native';

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export function validateImageUri(uri: string | null): void {
  if (!uri) {
    console.warn('[画像検証] URIがnullまたは空です');
    return;
  }

  if (typeof uri !== 'string') {
    console.error('[画像検証] URIが文字列ではありません');
    throw new Error('画像のURIが無効です（型エラー）');
  }

  // Web環境ではblob: URLは正常
  if (uri.startsWith('blob:')) {
    if (Platform.OS === 'web') {
      debugLog('[画像検証] Web環境のblob URLを許可');
      return;
    }

    const errorMessage = __DEV__
      ? `[画像エラー] blob: URL が検出されました。Expo Go では blob: URI は使えません。file:// または content:// を使用してください。URI: ${uri.substring(0, 100)}`
      : '画像の読み込みに失敗しました。もう一度選択してください。';
    
    console.error('[画像検証] blob URLエラー');
    throw new Error(errorMessage);
  }

  // Android/iOSで有効なURIスキームをチェック
  if (Platform.OS !== 'web') {
    const validSchemes = ['file://', 'content://', 'http://', 'https://'];
    const hasValidScheme = validSchemes.some(scheme => uri.startsWith(scheme));
    
    if (!hasValidScheme) {
      const errorMessage = `無効な画像URIスキーム: ${uri.substring(0, 50)}`;
      console.error('[画像検証] 無効なスキーム');
      throw new Error(errorMessage);
    }
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
