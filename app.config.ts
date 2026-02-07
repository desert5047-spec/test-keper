import type { ConfigContext, ExpoConfig } from 'expo/config';

const SUPABASE_URL = 'https://dzqzkwoxfciuhikvnlmg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rbyn5OYRcxTARliQAn8B7g_y5pkgOby';

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
      buildNumber: '14',
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
      versionCode: 4,
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
    },
  };
};
