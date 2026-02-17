import type { ConfigContext, ExpoConfig } from 'expo/config';

// EAS ビルド時はプロファイルごとの環境変数が注入される。ローカルは .env / .env.stg / .env.prod を参照
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://dzqzkwoxfciuhikvnlmg.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_rbyn5OYRcxTARliQAn8B7g_y5pkgOby';
const ENV_LABEL = process.env.EXPO_PUBLIC_ENV ?? 'dev';
const STORAGE_BUCKET = process.env.EXPO_PUBLIC_STORAGE_BUCKET ?? 'test-images';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    slug: 'test-album',
    scheme: 'testalbum',
    newArchEnabled: false,
    ios: {
      ...config.ios,
      newArchEnabled: false,
      bundleIdentifier: 'jp.testalbum.app',
      buildNumber: '3',
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              'testalbum',
              'com.googleusercontent.apps.810982918990-kuld3n986ifhnbtjl1m3c7426n7bs1rk',
            ],
          },
        ],
      },
    },
    android: {
      ...config.android,
      newArchEnabled: false,
      package: 'jp.testalbum.app',
      versionCode: 3,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'testalbum',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    extra: {
      ...(config.extra ?? {}),
      EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      EXPO_PUBLIC_ENV: ENV_LABEL,
      EXPO_PUBLIC_STORAGE_BUCKET: STORAGE_BUCKET,
    },
  };
};
