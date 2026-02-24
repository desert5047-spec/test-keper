import Constants from 'expo-constants';

const DEFAULT_LP_URL = 'https://www.test-album.jp';

const getExtraString = (key: string): string => {
  const extra =
    Constants.expoConfig?.extra ??
    (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra ??
    {};
  const value = extra[key];
  return typeof value === 'string' ? value : '';
};

/** Web LP のベース URL（環境に応じて stg/prod を切り替える） */
export const lpBaseUrl =
  process.env.EXPO_PUBLIC_LP_URL?.trim() ||
  getExtraString('EXPO_PUBLIC_LP_URL').trim() ||
  DEFAULT_LP_URL;

/** パスを付与した LP のフル URL（例: getLpUrl('/signup') → https://www.test-album.jp/signup） */
export function getLpUrl(path: string): string {
  const base = lpBaseUrl.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/** LP の host 部分（DebugLabel 表示用。例: www.test-album.jp / stg.test-album.jp） */
export function getLpHost(): string {
  try {
    return new URL(lpBaseUrl).hostname;
  } catch {
    return '—';
  }
}
