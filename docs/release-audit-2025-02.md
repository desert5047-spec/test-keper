# リリース前セキュリティ・クラッシュ点検 実施結果

実施日: 2025-02-12

## 修正が必要なファイル一覧

| ファイル | 修正内容 |
|----------|----------|
| `lib/logger.ts` | 本番でも error を出力（message のみ、生 Error 禁止） |
| `lib/openExternal.ts` | console.warn → logger.warn、URL/error をログに出さない |
| `app/auth-callback.tsx` | デバッグボックス（accessLen/refreshLen/errorDetail）を `__DEV__` で囲む |
| `utils/imageUpload.ts` | セッションログ簡略化（userId/sessErrMsg 削除）、ログ文言統一 |
| `app/(auth)/login.tsx` | （前回対応済） openExternal 使用 |
| `app/consent.tsx` | console.warn → logger.warn |
| `app/invite.tsx` | console.error → logError、logger import 追加 |
| `components/KeyboardAwareScroll.tsx` | keyboardDismissMode="interactive" 追加 |
| `app/add.tsx` | メモ入力 onFocus の scrollToEnd 削除（枠外飛び防止） |
| `app/(tabs)/index.tsx` | loadError 状態追加、通信エラー時 UI＋再試行ボタン |
| `app/(tabs)/list.tsx` | エラーメッセージ統一 |
| `docs/release-checklist.md` | メモ入力（iOS）の確認項目追加 |

## 主な変更内容

### 1) 本番ログ抑制
- `_layout.tsx` で `!__DEV__` 時に `console.log/info/debug/warn` を無効化（既存）
- `logger.error` は本番でも出力するよう変更（Error は message のみに変換）
- `openExternal`、`consent` の `console.warn` を `logger.warn` に統一
- `auth-callback` のデバッグUI（accessLen, refreshLen, errorDetail 等）を `__DEV__` で囲み、本番で非表示に
- 画像アップロード時のセッションログを `hasSession` の有無のみに簡略化

### 2) Supabase 認証・セッション周り
- セッションを丸ごとログに出していないことを確認済み
- トークン系は Supabase SDK に任せており、独自保存なし
- デバッグUIは本番で非表示

### 3) 画像アップロード/削除
- **add.tsx**: 画像アップロード失敗時に records をロールバック（既存どおり）
- **detail.tsx**: record_tags → storage → records の順で削除（既存どおり）
- **settings / children**: 同様の順序で整合性確保
- エラーログは message のみ

### 4) ネットワーク例外・オフライン
- **index.tsx**: 読み込み失敗時に「通信できません。接続を確認して再度お試しください」＋再試行ボタンを表示
- **list.tsx**: エラーメッセージを同様の文言に統一
- add.tsx は既に `isNetworkError` と `NETWORK_ERROR_USER_MESSAGE` で対応済み

### 5) iOS メモ入力の枠外問題
- メモ入力時の `onFocus` 内の `scrollToEnd` を削除（枠外に飛ぶ原因を除去）
- `KeyboardAwareScroll` に `keyboardDismissMode="interactive"` を追加

## 確認観点チェックリスト（手動テスト手順）

### ログ・セキュリティ
- [ ] 本番ビルドで console.log/info/debug/warn が出ない
- [ ] 認証コールバック画面でデバッグボックスが表示されない（本番）
- [ ] エラー時に token/access_token/refresh_token がログに出ない

### 認証
- [ ] ログイン・ログアウト
- [ ] パスワードリセットリンクがブラウザで開く（openExternal）
- [ ] エラー時にクラッシュせず、ユーザー向けメッセージが表示される

### 画像・記録
- [ ] 写真付き記録の保存・削除
- [ ] オフラインで保存試行時に適切なエラーメッセージ

### ネットワーク
- [ ] 機内モードでアプリ起動 → クラッシュしない
- [ ] 記録一覧読み込み失敗時に「通信できません…」＋再試行が表示される
- [ ] プルリフレッシュ失敗時に Alert でメッセージ表示

### iOS メモ入力
- [ ] 記録追加画面でメモ欄タップ → キーボード表示時、カーソルが枠外に飛ばない
- [ ] メモ入力中にフォーカスとスクロールが自然に動く
