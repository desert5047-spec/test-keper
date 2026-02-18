# リリース前チェックリスト（TestFlight / Android 内部テスト 共通）

本番ビルド（production profile）を TestFlight / Google Play 内部テストに提出する前の確認手順。

---

## 1. ビルドスクリプト

```bash
npm run build:ios:prod      # eas build -p ios --profile production
npm run build:android:prod  # eas build -p android --profile production
```

---

## 2. DebugLabel 非表示の確認

| 確認項目 | 手順 | 期待結果 |
|----------|------|----------|
| production ビルドで非表示 | `npm run build:ios:prod` または `build:android:prod` でビルド → 端末にインストール → 起動 | 画面上部右上に **DebugLabel（env/ref/domain）が表示されない** |
| 起動時ログで接続先確認 | 開発者ツール or `npx expo start` で接続し、本番ビルド起動時のログを確認 | `[Supabase] 接続先 host:` が **cwwzaknsitnaqqafbrsc** であること |

- **仕様**: production build（release）では必ず非表示。Expo Go/開発起動で `EXPO_PUBLIC_ENV=prod` の場合も非表示。
- stg/dev で envLabel を確認したい場合は `npm run start:stg` 等で起動する。

---

## 3. ログ抑制の確認

| 確認項目 | 手順 | 期待結果 |
|----------|------|----------|
| console.log/info/debug/warn 無効化 | 本番ビルドでアプリを操作し、開発者ツールのコンソールを確認 | **log/info/debug/warn の出力が出ない** |
| token/session/url の漏洩なし | ログイン・API 呼び出し中にコンソールを確認 | **access_token / refresh_token / Authorization / 署名付き URL** がログに出力されていない |
| console.error のみ出力 | エラー発生時にコンソールを確認 | 必要に応じて `console.error` のみ出力される（生の error オブジェクトではなく message のみ） |

### コードスキャン（release:scan）

```bash
npm run release:scan
```

または手動で以下を実行（`rg` がインストールされていること）:

```powershell
# console 出力箇所
rg "console\.(log|info|debug|warn|error)\(" -g "!node_modules" -g "!scripts" -g "!supabase/functions" app components lib utils hooks contexts

# token / session の痕跡
rg "access_token|refresh_token|Authorization|token=" -g "!node_modules" -g "!*.lock" app components lib utils hooks contexts

# signed URL のログ出し
rg "signed|sig=|expires=|X-Amz-" -g "!node_modules" app components lib utils hooks contexts
```

---

## 4. 認証系の確認チェックリスト

| # | 項目 | iOS | Android |
|---|------|-----|---------|
| 1 | 新規登録（メール） | □ | □ |
| 2 | ログイン（メール） | □ | □ |
| 3 | ログアウト | □ | □ |
| 4 | パスワード忘れ（メール送信） | □ | □ |
| 5 | パスワードリセット（メールリンク → 新パスワード入力） | □ | □ |
| 6 | ログイン情報を保存（スイッチON/OFF・再起動後も維持） | □ | □ |
| 7 | 認証エラー時に適切なメッセージ表示（クラッシュしない） | □ | □ |

- 確認メールのリンクが意図した LP（本番: www.test-album.jp）に飛ぶこと
- アプリへの復帰（Deep Link）が正しく動作すること

---

## 5. 画像アップロードの確認チェックリスト

| # | 項目 | iOS | Android |
|---|------|-----|---------|
| 1 | カメラで撮影 → プレビュー → 保存 | □ | □ |
| 2 | アルバムから写真を選択 | □ | □ |
| 3 | 写真の回転（右・左） | □ | □ |
| 4 | トリミング（編集画面） | □ | □ |
| 5 | 写真の削除（記録編集時） | □ | □ |
| 6 | 記録保存後に一覧・詳細に写真が反映される | □ | □ |
| 7 | Web で回転が完了する（処理中で止まらない） | □ | - |

-  large 画像でもクラッシュしないこと
- ネットワークエラー時に適切なメッセージ表示

---

## 6. オフライン（機内モード）時の確認

| # | 項目 | 期待結果 |
|---|------|----------|
| 1 | 機内モードでアプリ起動 | クラッシュせず、一般的なエラーメッセージ（「通信環境をご確認ください」等）が表示される |
| 2 | オンライン中に機内モードへ切り替え → 操作 | クラッシュせず、エラー時に適切なメッセージが表示される |
| 3 | オフラインで写真撮影・保存試行 | クラッシュせず、ネットワークエラー用メッセージが表示される |

---

## 7. iOS と Android で差が出やすい項目

| # | 項目 | 確認内容 |
|---|------|----------|
| 1 | 権限ダイアログ | カメラ・写真ライブラリの許可ダイアログが適切に表示され、拒否時もクラッシュしない |
| 2 | 写真ライブラリ | アルバム選択・写真表示が正しく動作する |
| 3 | 戻るボタン・スワイプ | Android の戻るボタン、iOS のスワイプバックで期待どおり遷移する |
| 4 | キーボード | メモ入力等でキーボード表示時に画面が隠れない（KeyboardAvoidingView 等が効いている） |
| 5 | テキスト色 | 「ログイン情報を保存」「キャンセル」「メモ」等のテキストが白背景で黒系で見える（Android で白字にならない） |
| 6 | フォント・レイアウト | 日本語が正しく表示され、レイアウトが崩れていない |

---

## 8. 提出前の最終スキャン

```bash
npm run release:scan
```

または [上記「コードスキャン」](#コードスキャンrelease-scan) のコマンドを手動実行し、token/session/url の漏洩がないことを確認する。
