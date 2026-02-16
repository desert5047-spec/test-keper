/**
 * 開発時のみログを出力する。本番では何も出さない。
 */
export const log = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};
export const warn = (...args: unknown[]) => {
  if (__DEV__) console.warn(...args);
};
export const error = (...args: unknown[]) => {
  if (__DEV__) console.error(...args);
};
