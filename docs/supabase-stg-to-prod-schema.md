# Supabase: STG → PROD スキーマのみ反映

**目的**: STG（テスト環境）のDB構造だけを、空の PROD（本番）に反映する。  
データ・Auth・Storage は移さない。

**前提**
- リポジトリに `supabase/` がある
- Supabase CLI が使える

**このリポジトリの環境**
| 環境 | Reference ID |
|------|------------------|
| STG（テスト） | `dzqzkwoxfciuhikvnlmg` |
| PROD（本番）  | `cwwzaknsitnaqqafbrsc` |

---

## 1) STG にリンク

```bash
cd /path/to/test-keper
supabase link --project-ref dzqzkwoxfciuhikvnlmg
```

---

## 2) STG の DB 状態をローカルへ取り込み（差分を migrations にする）

```bash
supabase db pull
```

- 新規マイグレーションが `supabase/migrations/` に追加される場合あり。既存ファイルが書き換わる場合もあるので、`git status` で確認すること。

---

## 3) migrations の目視チェック

以下を満たしているか確認する。

- [ ] **RLS**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` があるテーブルは、同じマイグレーションまたは後のマイグレーションで **必ず** `CREATE POLICY` が存在する（RLS オンでポリシーなしは NG）
- [ ] **ポリシー**: `CREATE POLICY ...` が想定テーブル分ある
- [ ] **関数**: `CREATE OR REPLACE FUNCTION ...` が必要なものは含まれている
- [ ] **トリガー**: `CREATE TRIGGER ...` が必要なものは含まれている
- [ ] **型**: `CREATE TYPE ...` が必要なものは含まれている
- [ ] **拡張**: `CREATE EXTENSION ...` が必要なものは含まれている

**チェック用（リポジトリ直下で実行）:**

```bash
# RLS あり & ポリシー漏れチェック（NG なら exit 1）
node scripts/check-migrations-rls.js
```

上記で OK と出ることを確認する。NG の場合は **作業を止め、先にポリシーを追加してから** 次へ進む。

その他の目視用:

```bash
# RLS が有効になっているテーブル
rg "ENABLE ROW LEVEL SECURITY" supabase/migrations --line-number

# ポリシー作成
rg "CREATE POLICY" supabase/migrations --line-number

# 関数・トリガー・型・拡張
rg "CREATE (OR REPLACE )?FUNCTION|CREATE TRIGGER|CREATE TYPE|CREATE EXTENSION" supabase/migrations --line-number
```

---

## 4) PROD にリンクし直す（本番は空である前提）

```bash
supabase link --project-ref cwwzaknsitnaqqafbrsc
```

---

## 5) migrations を PROD に適用

```bash
supabase db push
```

- エラーが出たら **そのコマンドの全文とエラーログを保存して作業を止める**。別手順に切り替えず、原因を確認する。

---

## 6) 適用後の確認（SQL Editor で OK）

PROD の Dashboard → SQL Editor で次を確認する。

- **テーブル**: `public` のテーブルが STG と揃っているか
- **RLS**: RLS を有効にしているテーブルには、ポリシーが作成されているか

例（確認用クエリ）:

```sql
-- public テーブル一覧
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- RLS が有効なテーブルとポリシー数
SELECT c.relname AS table_name,
       count(p.polname) AS policy_count
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
GROUP BY c.relname
ORDER BY c.relname;
```

`policy_count` が 0 のテーブルがあれば、ポリシーが漏れている。

---

## エラー時

- **どのコマンドで**（例: `supabase db push`）
- **どのエラーが出たか**（全文ログ）

を残す。  
**その時点で作業を止め、勝手に別手順に切り替えない。**
