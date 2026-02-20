/**
 * 開発時のみログを出力する。本番では何も出さない。
 * error は Error オブジェクトを message のみに変換（token 等の漏洩防止）
 */
export const log = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};
export const warn = (...args: unknown[]) => {
  if (__DEV__) console.warn(...args);
};
export const error = (...args: unknown[]) => {
  const safe = args.map((a) =>
    a instanceof Error ? (a.message || 'Unknown error') : a
  );
  console.error(...safe);
};

/**
 * 読み込み失敗時用。dev では console.error を出さず warn のみ（Expo Go 赤画面防止）。
 * 本番では error のみ。Error オブジェクトや URL は渡さないこと。
 */
export const logLoadError = (context: string) => {
  if (__DEV__) {
    console.warn(`[${context}] network failed`);
  } else {
    console.error(`[${context}]`);
  }
};
