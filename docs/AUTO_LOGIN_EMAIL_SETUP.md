# 自動ログイン + 登録完了メール送信の設定

## 要件

- ✅ メールとパスワードを設定したら自動でログインできる
- ✅ 登録完了メールを送信する

## 実装状況

### 1. コード側の設定（完了）

`contexts/AuthContext.tsx`の`signUp`関数で、`skip_email_confirmation: true`を設定しています。これにより、メール確認なしで自動ログインできます。

### 2. 登録完了メールの送信

登録完了メールを送信するには、以下のいずれかの方法を使用します：

---

## 方法1: Supabase Dashboardでメール確認を有効化（簡単だが確認リンクが必要）

**注意**: この方法では、メールに確認リンクが含まれますが、コード側で`skip_email_confirmation: true`を設定しているため、ユーザーは確認リンクをクリックしなくてもログインできます。

### 設定手順

1. **Supabase Dashboard** → **Authentication** → **Settings**
2. **Enable email confirmations** を **ON** にする
3. **Email Templates** → **Confirm signup** をカスタマイズ
4. メール本文に確認リンクを含める（ユーザーはクリックしなくてもログインできます）

**メリット**: 設定が簡単、追加のコード不要

**デメリット**: メールに確認リンクが含まれる（ただし、クリックしなくてもログイン可能）

---

## 方法2: Database Trigger + Edge Function（推奨・確認リンク不要）

確認リンクなしの純粋な登録完了メールを送信する場合。

### 前提条件

- Supabase CLIがインストールされていること
- Resendアカウント（または他のメール送信サービス）

### 設定手順

#### ステップ1: Resendアカウントの作成

1. [Resend](https://resend.com) にアカウントを作成
2. APIキーを生成
3. ドメインを設定

#### ステップ2: Edge Functionのデプロイ

```bash
# Supabase CLIでログイン
supabase login

# プロジェクトをリンク
supabase link --project-ref your-project-ref

# Edge Functionをデプロイ
supabase functions deploy send-signup-email
```

#### ステップ3: 環境変数の設定

Supabase Dashboard → **Project Settings** → **Edge Functions** → **send-signup-email** → **Settings**:

- `RESEND_API_KEY`: ResendのAPIキー
- `FROM_EMAIL`: 送信元メールアドレス（例: `noreply@yourdomain.com`）

#### ステップ4: Database設定

Supabase Dashboard → **SQL Editor** で実行:

```sql
-- Edge FunctionのURLを設定（your-project-refを実際のプロジェクト参照IDに置き換える）
ALTER DATABASE postgres SET app.send_signup_email_url = 'https://your-project-ref.supabase.co/functions/v1/send-signup-email';
```

#### ステップ5: マイグレーションの実行

```bash
supabase db push
```

または、Supabase Dashboard → **SQL Editor** で `supabase/migrations/20260126000000_add_signup_email_trigger.sql` の内容を実行

#### ステップ6: Supabase Dashboardの設定

1. **Authentication** → **Settings** → **Enable email confirmations** を **OFF** にする
2. **Authentication** → **Emails** → **SMTP Settings** → **Enable custom SMTP** を **OFF** にする（Supabaseのデフォルトメール機能を使用する場合）

### メリット

- 確認リンクなしの純粋な登録完了メール
- 完全にカスタマイズ可能なHTMLメール
- メール確認をスキップしてもメールが送信される

### デメリット

- 設定が複雑
- Resendなどの追加サービスが必要

---

## 推奨設定

**開発初期段階**: 方法1を使用（簡単）

**本番環境**: 方法2を使用（確認リンクなしの純粋な登録完了メール）

---

## 現在の動作

現在のコード設定では：

1. ✅ ユーザーが登録すると、メール確認をスキップして自動ログイン
2. ❌ 登録完了メールは送信されない（Database Trigger + Edge Functionを設定する必要がある）

登録完了メールを送信するには、上記の方法1または方法2を設定してください。
