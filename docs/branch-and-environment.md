# ブランチと環境の対応

## 前提

- **main** = 本番（prod）
- **develop** = ステージング（stg）

## 環境の切り分け

| 項目           | STG (develop)     | PROD (main)       |
|----------------|-------------------|-------------------|
| ブランチ       | `develop`         | `main`            |
| EAS ビルドプロファイル | `preview`    | `production`      |
| EAS 環境変数   | **preview**       | **production**    |
| distribution   | **store**（TestFlight 向け・端末登録不要） | **store**         |
| Supabase       | STG プロジェクト  | PROD プロジェクト |
| 環境表示       | アプリ内に "stg"  | 本番は極薄表示    |

**重要**: ビルドプロファイルと EAS の environment は固定です。  
`--profile preview` → 必ず EAS environment **preview** を参照、`--profile production` → 必ず **production** を参照します（`eas.json` の `build.*.environment` で指定済み）。

---

## Supabase URL / キーの設定（EAS ビルド用）

Supabase の URL と publishable key は**秘密情報**のため、`eas.json` やリポジトリには入れません。  
**EAS Dashboard の Environment Variables** に登録して使います。

### 注意事項

- **`sb_secret_...` は絶対に登録しない**（クライアントには publishable key のみ）
- **repo / eas.json にキーを書かない**
- ビルドプロファイルと EAS environment の対応は固定（preview → preview、production → production）

---

### EAS Dashboard で設定する手順

1. [Expo Dashboard](https://expo.dev) でプロジェクトを開く
2. **Project settings** → **Environment variables**
3. 環境を選び、変数を追加する

#### Environment = **preview**（stg）に追加

| 変数名 | 値 |
|--------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://dzqzkwoxfciuhikvnlmg.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_rbyn5OYRcxTARliQAn8B7g_y5pkgOby` |

#### Environment = **production**（prod）に追加

| 変数名 | 値 |
|--------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://cwwzaknsitnaqqafbrsc.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_8fR6T36b95UOuwSU84O-qw_DTkupAEC` |

（PROD の publishable key を変更した場合は、ここをその値に更新する。）

---

### CLI で設定する場合

プロジェクト直下で以下を実行する。

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://dzqzkwoxfciuhikvnlmg.supabase.co"

eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_rbyn5OYRcxTARliQAn8B7g_y5pkgOby"

eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://cwwzaknsitnaqqafbrsc.supabase.co"

eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_8fR6T36b95UOuwSU84O-qw_DTkupAEC"
```

---

## 動作確認手順

ビルド後にアプリで次を確認する。

| 確認項目 | STG（preview ビルド） | PROD（production ビルド） |
|----------|------------------------|----------------------------|
| DebugLabel | `EXPO_PUBLIC_ENV=stg` かつ開発起動時に **stg** 表示。release ビルドでは非表示 | **非表示**。prod 環境では開発起動でも表示しない（意図した仕様） |
| Supabase 接続先 | URL のホストが **dzqzkwoxfciuhikvnlmg** であること | URL のホストが **cwwzaknsitnaqqafbrsc** であること |

- ログで確認する場合は **URL のホストだけ** を出し、キー全文は絶対にログに出さないこと。

**ビルドコマンド例**

```bash
# stg 用ビルド（EAS environment: preview が使われる）
eas build -p ios --profile preview

# prod 用ビルド（EAS environment: production が使われる）
eas build -p ios --profile production
```

---

## ビルド番号が重複した時の対処（"You've already submitted this build"）

このプロジェクトでは **EAS の remote versioning**（`cli.appVersionSource: "remote"`）を使っています。  
そのため **app.config.ts の `ios.buildNumber` を変更しても、EAS 側の値が優先され、重複エラーが解消しない場合があります。**

### 再発防止の流れ

1. **EAS 側の iOS バージョン情報を同期・初期化**
   ```bash
   eas build:version:set
   ```
   - platform で **iOS** を選択
   - version source は **remote** のまま
   - 初期値に、App Store Connect で最後に提出した **build number（CFBundleVersion）** を入力して EAS と揃える

2. **新しいビルドを作成**（preview / production ともに `ios.autoIncrement: "buildNumber"` で毎回 build number が増える）
   ```bash
   eas build -p ios --profile preview
   # または
   eas build -p ios --profile production
   ```

3. **提出時は「最新のビルド」を選ぶ**
   ```bash
   eas submit -p ios --profile production
   ```
   - 「Select a build from EAS」で **日時が一番新しいビルド** を選ぶ（同じ build number のビルドを二重で submit しない）

### 事故防止（提出前の確認）

- 提出前に最新ビルドの build number を確認する:
  ```bash
  eas build:list -p ios --limit 5
  ```
  または EAS Dashboard で該当ビルドの build number を確認する。
- **同じ build number のビルドがすでに submit 済みの場合は、submit せずに新しいビルドを作り直してから提出する。**

---

## 運用

- 機能開発・検証は `develop` で行い、**preview** プロファイルでビルドして TestFlight 等に配布する。
- 本番反映時は `develop` を `main` にマージし、**production** プロファイルでビルドする。
- ローカル開発では `.env.stg` または `.env.prod` を `.env.example` からコピーして値を設定する（いずれも gitignore 済み）。
