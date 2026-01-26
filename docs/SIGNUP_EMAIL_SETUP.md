# 新規登録完了メール送信の設定ガイド

このドキュメントでは、新規登録時に自動的にメールを送信する機能の設定方法を説明します。

## 方法1: Supabase Dashboardのメールテンプレートを使用（推奨・簡単）

最も簡単な方法は、Supabase Dashboardのメールテンプレート機能を使用することです。

### 設定手順

1. **Supabase Dashboard** にログイン
2. **Authentication** → **Email Templates** に移動
3. **Confirm signup** テンプレートを選択
4. 以下のような内容にカスタマイズ:

```
件名: テストキーパーへのご登録ありがとうございます

{{ .Email }} 様

この度は、テストキーパーにご登録いただき、誠にありがとうございます。

アカウントの登録が完了いたしました。以下の機能をご利用いただけます：

- テスト結果の記録と管理
- 画像付きでの記録保存
- 月次統計の確認
- 目標設定と達成状況の追跡

アプリを開いて、お子様の頑張りを記録していきましょう！

ご不明な点がございましたら、お気軽にお問い合わせください。

今後ともテストキーパーをよろしくお願いいたします。
```

5. **Enable email confirmations** を有効にする（必要に応じて）

### メリット

- 設定が簡単
- 追加のコード不要
- Supabaseの標準機能を使用

### デメリット

- メールテンプレートのカスタマイズに制限がある
- HTMLメールの高度なカスタマイズが難しい

---

## 方法2: Database Trigger + Edge Functionを使用（高度）

より柔軟なメール送信が必要な場合は、Database TriggerとEdge Functionを使用します。

### 前提条件

- Supabase CLIがインストールされていること
- Resendアカウント（または他のメール送信サービス）

### 設定手順

#### 1. Resendアカウントの作成

1. [Resend](https://resend.com) にアカウントを作成
2. APIキーを生成
3. ドメインを設定

#### 2. Edge Functionのデプロイ

```bash
# Supabase CLIでログイン
supabase login

# プロジェクトをリンク
supabase link --project-ref your-project-ref

# Edge Functionをデプロイ
supabase functions deploy send-signup-email
```

#### 3. 環境変数の設定

Supabase Dashboard → **Project Settings** → **Edge Functions** → **send-signup-email** → **Settings**:

- `RESEND_API_KEY`: ResendのAPIキー
- `FROM_EMAIL`: 送信元メールアドレス

#### 4. Database設定

Supabase Dashboard → **SQL Editor** で実行:

```sql
-- Edge FunctionのURLを設定
ALTER DATABASE postgres SET app.send_signup_email_url = 'https://your-project-ref.supabase.co/functions/v1/send-signup-email';
```

#### 5. マイグレーションの実行

```bash
supabase db push
```

### メリット

- 完全にカスタマイズ可能なHTMLメール
- メール送信サービスの選択が自由
- より高度な機能を実装可能

### デメリット

- 設定が複雑
- 追加のコストが発生する可能性（Resendなど）

---

## 推奨事項

**開発初期段階**: 方法1（Supabase Dashboardのメールテンプレート）を使用

**本番環境で高度なカスタマイズが必要な場合**: 方法2（Database Trigger + Edge Function）を使用

---

## トラブルシューティング

### メールが送信されない

1. Supabase Dashboard → **Authentication** → **Settings** でメール設定を確認
2. SMTP設定が正しく構成されているか確認
3. Edge Functionのログを確認（方法2の場合）

### メールがスパムフォルダに入る

1. SPF、DKIM、DMARCレコードを設定
2. 送信元ドメインの信頼性を向上

---

## 参考リンク

- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Resend Documentation](https://resend.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
