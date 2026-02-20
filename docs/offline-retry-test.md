# オフライン・再試行 手動テスト手順

## 修正の要点

- **Expo Go（dev）で機内モード時に赤画面にならない**  
  読み込み失敗時は `logLoadError(context)` を使用。dev では `console.warn` のみ（短いメッセージ）、本番では `console.error` のみ。Error オブジェクトや URL はログに出さない。対象: 一覧（list）、ホーム（index）、記録（monthly）。
- **再試行は常に「現在の childId / 月」で実行される**  
  `loadRecords` の `useCallback` 依存配列に `year`, `month`, `selectedChildId`, `isFamilyReady`, `familyId` が含まれており、再試行ボタンは `loadRecords()` をそのまま呼ぶため、最新の条件で再取得される。
- **取得失敗時は一覧を上書きしない**  
  `setRecords` / `setStableSections` は成功時のみ実行。失敗時は `setLoadError` のみで、前回成功分の一覧を維持。
- **最終更新時刻**  
  成功時に `lastUpdatedAt` を更新し、エラー時は「最終更新: HH:mm」をバナーまたは全面エラー画面に表示。

---

## 手動テスト手順

### 前提

- 複数子供を登録済み
- 各子供で記録が存在する月がある

### 1. 子供変更 → 機内モード → 復帰 → 再試行で「今の子供」が使われるか

1. **ホーム（index）**
   - 子供 A を選択し、一覧が表示されることを確認
   - 子供 B に切り替え、一覧が B の内容に変わることを確認
   - **機内モード ON**
   - プルリフレッシュまたは画面フォーカスで再取得 → 失敗する想定
   - **機内モード OFF**
   - 「再試行」をタップ
   - **確認**: 子供 B の一覧が再取得される（子供 A の一覧になっていない）

2. **一覧（list）**
   - 上記と同様に、子供 A → 子供 B に切り替え
   - 機内モード ON → 失敗 → 機内モード OFF → 再試行
   - **確認**: 子供 B の一覧が再取得される

3. **記録（monthly）**
   - 子供 A → 子供 B に切り替え
   - 機内モード ON → 失敗 → 機内モード OFF → 再試行
   - **確認**: 子供 B の月別サマリーが再取得される。機内モード中に「Console Error: Network request failed」で赤画面にならない（UI の「通信できません」+ 再試行に落ちる）

### 2. 月変更 → 機内モード → 復帰 → 再試行で「今の月」が使われるか

1. 対象月に記録がある状態で、その月を表示
2. 別の月に切り替え
3. 機内モード ON → 失敗 → 機内モード OFF → 再試行
4. **確認**: 切り替えた先の月の一覧が再取得される（前の月の一覧になっていない）

### 3. 失敗時に前回成功分が残り、バナー＋再試行になるか

1. 一覧を表示（記録が 1 件以上ある状態）
2. 機内モード ON
3. プルリフレッシュまたは別タブ往復で再取得を発生させる
4. **確認**:
   - 一覧は空にならず、直前まで表示していた記録がそのまま残る
   - 画面上部に「通信できません（最終更新: HH:mm）」バナーと「再試行」ボタンが表示される
5. 機内モード OFF で「再試行」をタップ
6. **確認**: 一覧が更新され、バナーが消える

### 4. 初回ロード失敗時は全面エラー＋最終更新＋再試行

1. 機内モード ON のまま、子供を切り替えるか、初回表示になる画面を開く
2. **確認**: 「通信できません。接続を確認して再度お試しください」と「最終更新: HH:mm」（一度も成功していなければ表示されない）、「再試行」が表示される
3. 機内モード OFF → 再試行
4. **確認**: 現在の子供・月の一覧が取得され、通常表示になる

---

## 該当箇所の指摘（依存配列・初期値）

- **index.tsx**
  - `loadRecords` の依存配列: `[year, month, selectedChildId, isFamilyReady, familyId]` で問題なし。再試行は `loadRecords()` をそのまま呼ぶため、常に最新の state を参照する。
- **list.tsx**
  - 同様に `loadRecords` の依存配列に `year, month, selectedChildId, isFamilyReady, familyId` が含まれており、再試行で「今の条件」が使われる。
- **monthly.tsx（記録タブ）**
  - `loadMonthlySummaries` の依存配列に `year, month, selectedChildId, isFamilyReady, familyId` を含めてあり、再試行で最新条件が使われる。失敗時は `setMonthlySummaries` / `setStableSummaries` を呼ばず、`setLoadError` のみ。try/catch でネットワーク例外を捕捉し、`logLoadError('記録読み込み')` で dev 赤画面を防止。
- 失敗時に `setRecords` / `setStableSections` / `setMonthlySummaries` を呼んでいた箇所はなし（成功時のみ設定）。失敗時は `setLoadError` のみとし、`lastUpdatedAt` の更新とバナー/全面エラー表示を追加済み。エラー種別は `'offline' | 'unknown' | null` で保持し、表示文言は「通信できません。接続を確認して再度お試しください」「再試行」で統一。
