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
  if (!__DEV__) return;
  const safe = args.map((a) => (a instanceof Error ? a.message : a));
  console.error(...safe);
};
