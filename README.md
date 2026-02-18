# Test Album

## 配布目的（MVP）
- iOS: TestFlight
- Android: Google Play 内部テスト（Internal testing）
- Expo(EAS) でビルド～提出まで

## リポジトリ構成
- **ルート**: Expo アプリ（EAS ビルド・Expo Go）
- **web/**: Next.js の LP（新規登録・パスワードリセット・規約ページ）。stg は `https://stg.test-album.jp`、本番は `https://www.test-album.jp` にデプロイ。詳細は [web/README.md](web/README.md)。

## 事前確認
- `app.json` の `ios.bundleIdentifier` / `android.package` が確定していること
- `eas.json` が存在すること
- EAS CLI が使えること（`npx eas --version`）

## ブランチと環境
- **main** = 本番（prod）。EAS プロファイル **production** でビルド。
- **develop** = ステージング（stg）。EAS プロファイル **preview** でビルド（**distribution: store**＝TestFlight 向け。端末登録不要で `eas build -p ios --profile preview` が通る）。

詳細は [docs/branch-and-environment.md](docs/branch-and-environment.md) を参照。

## 運用（STG/PROD 切替）

| 用途 | 方法 | 接続先 |
|------|------|--------|
| **Expo Go（ローカル）** | `npm run start:stg`（cross-env） | STG: dzqzkwoxfciuhikvnlmg |
| | `npm run start:prod`（cross-env） | PROD: cwwzaknsitnaqqafbrsc |
| **EAS ビルド（STG）** | `eas build -p ios --profile preview` | EAS environment **preview** → STG |
| **EAS ビルド（PROD）** | `eas build -p ios --profile production` | EAS environment **production** → PROD |

**確認項目（表示と実接続の一致）**
- 右上の **DebugLabel**（環境 / Supabase ref / LP host。例: `prod / cwwzaknsitnaqqafbrsc` と `www.test-album.jp`）
- 起動時ログ **`[Supabase] 接続先 host:`** が意図した host であること
- データが意図した Supabase（STG または PROD）に入ること
- アプリから開く Web リンク（新規登録・パスワードリセットなど）が意図した環境の LP（stg なら stg Web、prod なら www）に飛ぶこと

## 環境変数（EAS ビルド前の準備）

- **ビルドプロファイルと EAS environment は固定**: `--profile preview` → EAS environment **preview**、`--profile production` → **production**（`eas.json` の `environment` で指定済み）。URL/KEY は **repo や eas.json に書かず、EAS 側で管理する**。
- **EAS Dashboard（expo.dev）で設定する**
  1. プロジェクトを開く → **Project settings** → **Environment variables**
  2. **Environment = preview** に追加:
     - `EXPO_PUBLIC_SUPABASE_URL` = `https://dzqzkwoxfciuhikvnlmg.supabase.co`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_rbyn5OYRcxTARliQAn8B7g_y5pkgOby`
     - `EXPO_PUBLIC_LP_URL` = ステージング用 Web URL（例: `https://stg.test-album.jp` または Vercel Preview URL）
  3. **Environment = production** に追加:
     - `EXPO_PUBLIC_SUPABASE_URL` = `https://cwwzaknsitnaqqafbrsc.supabase.co`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_8fR6T36b95UOuwSU84O-qw_DTkupAEC`
     - `EXPO_PUBLIC_LP_URL` = `https://www.test-album.jp`
- **注意**: `sb_secret_...` は絶対に登録しない。publishable key（`sb_publishable_...`）のみ使用する。
- **EXPO_PUBLIC_LP_URL**: アプリから開く Web リンク（新規登録・パスワードリセット・規約ページなど）のベース URL。stg ビルドでは STG 用 Web、prod ビルドでは本番 Web に揃える。
- 詳細・CLI での設定例は [docs/branch-and-environment.md](docs/branch-and-environment.md) を参照。

## ローカル確認方法（expo start）

Expo Go で STG / PROD をコマンド一発で切り替えて起動する場合：

- **STG**
  ```bash
  npm run start:stg
  ```
- **PROD**
  ```bash
  npm run start:prod
  ```

**確認項目**

- 右上の **DebugLabel**（環境 / Supabase ref / LP host）
- 起動時のコンソールログ **`[Supabase] 接続先 host:`** が、選択した環境の host になっていること
- データが意図した環境（STG または PROD）に入ること
- **Web リンク（動作確認）**
  - `npm run start:stg` → ログイン画面の「Webで新規登録」などから **stg.test-album.jp** に飛び、Web 上は **stg 表示**になること
  - `npm run start:prod` → 同様に **www.test-album.jp** に飛び、Web 上は **prod 表示**になること  
  （stg 起動時に www に飛んで Web が prod になる事故を防ぐため、必ず確認する）

## EAS ビルド手順

```bash
eas login
eas init

# ステージング（TestFlight 向け・端末登録不要）→ EAS environment: preview を参照
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
- 画面上部の **DebugLabel** は「環境 / Supabase project ref」を表示する（例: `prod / cwwzak…`）。**表示と実接続が一致しているか**を必ず確認する。

### prod ビルドなのに stg に繋がる場合のチェック項目

DebugLabel が **prod** なのに実際の Supabase 接続が **stg**（host が dzqzkwoxfciuhikvnlmg）になっている場合は、次を確認する。

1. **expo.dev の Environment variables（production）**
   - [Expo Dashboard](https://expo.dev) → プロジェクト → **Project settings** → **Environment variables**
   - **Environment = production** に `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` が登録されているか
   - 値が **PROD 用**（URL が `https://cwwzaknsitnaqqafbrsc.supabase.co`、key が PROD の publishable key）であるか

2. **ビルド番号・バージョンの確認**
   - `eas build:list -p ios --limit 5` または EAS Dashboard で、提出したビルドが **production プロファイル**でビルドされたものか確認する
   - build number / versionCode が意図したビルドと一致しているか

3. **アプリの再インストール**
   - 古いビルド（stg 用の環境変数でビルドされたもの）が端末に残っている可能性がある
   - TestFlight から **最新の production ビルドを再インストール**し、起動後の DebugLabel が `prod / cwwzak…` になっているか確認する

4. **app.config.ts の挙動**
   - `EXPO_PUBLIC_ENV=prod` のときは、Supabase URL/KEY が未設定だと **ビルド時に throw する**ため、production プロファイルで EAS 環境変数が渡っていないとビルドが失敗する。ビルドが通っているのに stg に繋がる場合は、端末上のアプリが古いビルドである可能性が高い。

### ビルド番号が重複した時の対処（"You've already submitted this build"）

`eas.json` では **preview / production ともに `ios.autoIncrement: "buildNumber"` と profile の `autoIncrement: true`** を設定してあり、EAS の **remote versioning**（`cli.appVersionSource: "remote"`）でビルドごとに build number が自動で増える想定です。

- **app.config.ts の `ios.buildNumber` を変えても、remote が優先されるため重複エラーが解消しない場合があります。**
- その場合は、EAS 側のバージョン情報を合わせてから、**新しいビルド**を作り、**その最新ビルドを選んで submit** してください。

**手順（推奨）**

1. **EAS の iOS バージョン情報を同期・初期化**
   ```bash
   eas build:version:set
   ```
   - platform で **iOS** を選択
   - version source は **remote** のまま（または設定）
   - 初期値には、App Store Connect で最後に提出した **build number（CFBundleVersion）** を入力して EAS と揃える

2. **新しいビルドを作成**
   ```bash
   eas build -p ios --profile preview
   # または
   eas build -p ios --profile production
   ```

3. **提出時は「最新のビルド」を選ぶ**
   ```bash
   eas submit -p ios --profile production
   ```
   - 「Select a build from EAS」では **日時が一番新しいビルド** を選ぶ（同じ build number のビルドを二重で submit しない）

**事故防止（提出前の確認）**

- 提出前に、最新ビルドの build number を確認する:
  ```bash
  eas build:list -p ios --limit 5
  ```
  または EAS Dashboard で該当ビルドの build number を確認する。
- すでに submit 済みの build number と同じ番号のビルドは選ばず、**新しいビルドを作成してから submit** する。

詳細は [docs/branch-and-environment.md](docs/branch-and-environment.md) も参照。

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
  - Site URL: 本番は `https://www.test-album.jp`（stg プロジェクトの場合は `https://stg.test-album.jp`）
  - **Redirect URLs**（本番と stg を両方追加。www は消さない）:
    - 本番: `https://www.test-album.jp/auth/callback`、`https://www.test-album.jp/*`
    - stg: `https://stg.test-album.jp/auth/callback`、`https://stg.test-album.jp/*`（必要なら `https://stg.test-album.jp/auth/confirmed`）

## 確認手順（メールリンク）
1. Supabase URL Config に上記の URL が入っていることを確認
2. アプリからパスワードリセット → メールリンクを開く
   - `/auth/callback` が開く
   - `testalbum://auth-callback` でアプリが起動
   - 新しいパスワード入力画面へ遷移
3. 新規登録メールのリンクも `/auth/callback` に戻ることを確認
