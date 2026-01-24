export function validateImageUri(uri: string | null): void {
  if (!uri) return;

  if (uri.startsWith('blob:')) {
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

  return uri.startsWith('file://') ||
         uri.startsWith('content://') ||
         uri.startsWith('http://') ||
         uri.startsWith('https://');
}
