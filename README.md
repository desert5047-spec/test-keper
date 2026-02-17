# Test Album

## 配布目的（MVP）
- iOS: TestFlight
- Android: Google Play 内部テスト（Internal testing）
- Expo(EAS) でビルド～提出まで

## 事前確認
- `app.json` の `ios.bundleIdentifier` / `android.package` が確定していること
- `eas.json` が存在すること
- EAS CLI が使えること（`npx eas --version`）

## ブランチと環境
- **main** = 本番（prod）。EAS プロファイル **production** でビルド。
- **develop** = ステージング（stg）。EAS プロファイル **preview** でビルド。

詳細は [docs/branch-and-environment.md](docs/branch-and-environment.md) を参照。

## 環境変数（EAS ビルド前の準備）

- **ビルドプロファイルと EAS environment は固定**: `--profile preview` → EAS environment **preview**、`--profile production` → **production**（`eas.json` の `environment` で指定済み）。URL/KEY は **repo や eas.json に書かず、EAS 側で管理する**。
- **EAS Dashboard（expo.dev）で設定する**
  1. プロジェクトを開く → **Project settings** → **Environment variables**
  2. **Environment = preview** に追加:
     - `EXPO_PUBLIC_SUPABASE_URL` = `https://dzqzkwoxfciuhikvnlmg.supabase.co`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_rbyn5OYRcxTARliQAn8B7g_y5pkgOby`
  3. **Environment = production** に追加:
     - `EXPO_PUBLIC_SUPABASE_URL` = `https://cwwzaknsitnaqqafbrsc.supabase.co`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_8fR6T36b95UOuwSU84O-qw_DTkupAEC`
- **注意**: `sb_secret_...` は絶対に登録しない。publishable key（`sb_publishable_...`）のみ使用する。
- 詳細・CLI での設定例は [docs/branch-and-environment.md](docs/branch-and-environment.md) を参照。

## EAS ビルド手順

```bash
eas login
eas init

# ステージング（TestFlight 等の検証用）→ EAS environment: preview を参照
eas build -p ios --profile preview
eas build -p android --profile preview

# 本番 → EAS environment: production を参照
eas build -p ios --profile production
eas build -p android --profile production
eas submit -p ios --profile production
eas submit -p android --profile production
```

### 動作確認（ビルド後）

| ビルド | 確認項目 |
|--------|----------|
| **STG** `eas build -p ios --profile preview` | DebugLabel が **stg**。起動時ログで接続先 host が **dzqzkwoxfciuhikvnlmg** であること。 |
| **PROD** `eas build -p ios --profile production` | DebugLabel が **prod**（極薄）。接続先 host が **cwwzaknsitnaqqafbrsc** であること。 |

- ログには接続先の **host だけ**を出し、キー全文は出さない（`lib/supabase.ts` で起動時に host のみ `[Supabase] 接続先 host:` で出力済み）。
- **テスト項目**: 新規登録・ログイン・写真アップロード（bucket=test-images）が、STG/PROD それぞれで期待どおり動作することを確認する。

## 追加された iOS 権限文言
`app.json` の `expo.ios.infoPlist` に追加済みです。
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`

## 識別子の注意
- 現在の設定:
  - `ios.bundleIdentifier`: `jp.testalbum.app`
  - `android.package`: `jp.testalbum.app`
- Android の `applicationId` はハイフンを使えないため、`android.package` は `jp.testalbum.app` を採用しています。
- `scheme` は `testalbum` です。変更する場合はアプリ内のDeep Link設定も更新が必要です。

## Supabase 認証リンク設定（確認メール/パスワードリセット）
Supabase ダッシュボードで以下を設定してください。

- Authentication → URL Configuration
  - Site URL: `https://www.test-album.jp`
  - Redirect URLs:
    - `https://www.test-album.jp/auth/callback`
    - （必要なら）`https://www.test-album.jp/*`

## 確認手順（メールリンク）
1. Supabase URL Config に上記の URL が入っていることを確認
2. アプリからパスワードリセット → メールリンクを開く
   - `/auth/callback` が開く
   - `testalbum://auth-callback` でアプリが起動
   - 新しいパスワード入力画面へ遷移
3. 新規登録メールのリンクも `/auth/callback` に戻ることを確認
