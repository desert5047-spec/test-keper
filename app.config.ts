import 'dotenv/config';
import type { ExpoConfig, ConfigContext } from 'expo/config';
import dotenv from 'dotenv';
import path from 'path';

// NODE_ENV=production のとき .env.production を読み込む（ローカル事前評価・config:prod 用）
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });
}

function must(name: string) {
  const v = process.env[name];
  return v && v.length > 0 ? v : '';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  // 1) 環境判定（優先順：EAS_BUILD_PROFILE > EXPO_PUBLIC_ENV > NODE_ENV）
  const buildProfile = process.env.EAS_BUILD_PROFILE; // production / preview / development など
  const env =
    process.env.EXPO_PUBLIC_ENV ||
    (buildProfile === 'production' ? 'prod' : buildProfile === 'preview' ? 'stg' : 'dev');

  let supabaseUrl = must('EXPO_PUBLIC_SUPABASE_URL');
  let supabaseAnonKey = must('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  // 2) prod だけは必須（ローカルの npx expo config でも落ちるので .env.production を許容）
  if (env === 'prod') {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    if (missing.length) {
      throw new Error(
        `[app.config] EXPO_PUBLIC_ENV=prod のため必須環境変数が不足しています: ${missing.join(
          ', '
        )}\n` +
          `対処: (1) EAS production env に追加 (2) ローカルは .env.production を作成して値を入れる`
      );
    }
  } else {
    // stg/dev は未設定時フォールバック
    if (!supabaseUrl) supabaseUrl = 'https://dzqzkwoxfciuhikvnlmg.supabase.co';
    if (!supabaseAnonKey) supabaseAnonKey = 'sb_publishable_rbyn5OYRcxTARliQAn8B7g_y5pkgOby';
  }

  return {
    ...config,
    name: 'Test Album',
    slug: 'test-album',
    scheme: 'testalbum',
    newArchEnabled: false,
    ios: {
      ...config.ios,
      newArchEnabled: false,
      bundleIdentifier: 'jp.testalbum.app',
      buildNumber: '5',
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        NSCameraUsageDescription: 'テストの写真を撮影するためにカメラを使用します。',
        NSPhotoLibraryUsageDescription:
          'テストの写真を選択するために写真ライブラリへアクセスします。',
        NSPhotoLibraryAddUsageDescription:
          '撮影した写真を写真ライブラリに保存するために使用します。',
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
      versionCode: 5,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'testalbum' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    extra: {
      ...config.extra,
      EXPO_PUBLIC_ENV: env,
      EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
      EXPO_PUBLIC_STORAGE_BUCKET: process.env.EXPO_PUBLIC_STORAGE_BUCKET ?? 'test-images',
      EXPO_PUBLIC_LP_URL: process.env.EXPO_PUBLIC_LP_URL ?? 'https://www.test-album.jp',
    },
  };
};
