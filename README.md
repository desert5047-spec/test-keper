# Test Album

## 配布目的（MVP）
- iOS: TestFlight
- Android: Google Play 内部テスト（Internal testing）
- Expo(EAS) でビルド～提出まで

## 事前確認
- `app.json` の `ios.bundleIdentifier` / `android.package` が確定していること
- `eas.json` が存在すること
- EAS CLI が使えること（`npx eas --version`）

## EAS コマンド
```bash
eas login
eas init

# iOS
eas build -p ios --profile production
eas submit -p ios --profile production

# Android
eas build -p android --profile production
eas submit -p android --profile production
```

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
