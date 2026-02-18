import { lpBaseUrl } from '@/lib/lpUrl';

/** Web LP のベース URL（EXPO_PUBLIC_LP_URL。stg/本番で切替） */
export const LP_URL = lpBaseUrl;

/** アプリから開く Web の URL を一箇所に集約。環境切替は EXPO_PUBLIC_LP_URL だけで揃う */
export const webUrls = {
  signup: `${LP_URL.replace(/\/$/, '')}/signup`,
  forgotPassword: `${LP_URL.replace(/\/$/, '')}/reset-password`,
  privacy: `${LP_URL.replace(/\/$/, '')}/privacy-policy`,
  terms: `${LP_URL.replace(/\/$/, '')}/terms`,
  authCallback: `${LP_URL.replace(/\/$/, '')}/auth/callback`,
  deleteAccount: `${LP_URL.replace(/\/$/, '')}/delete-account`,
};
