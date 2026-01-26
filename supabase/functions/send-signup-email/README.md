# 新規登録完了メール送信 Edge Function

このEdge Functionは、ユーザーが新規登録した際に自動的に登録完了メールを送信します。

## セットアップ手順

### 1. Resendアカウントの作成とAPIキーの取得

1. [Resend](https://resend.com) にアカウントを作成
2. API KeysページでAPIキーを生成
3. ドメインを設定（メール送信元として使用）

### 2. Supabase Dashboardでの設定

1. **Project Settings** → **Edge Functions** に移動
2. この関数をデプロイ:
   ```bash
   supabase functions deploy send-signup-email
   ```

3. **Project Settings** → **Edge Functions** → **send-signup-email** → **Settings** で環境変数を設定:
   - `RESEND_API_KEY`: ResendのAPIキー
   - `FROM_EMAIL`: 送信元メールアドレス（例: noreply@yourdomain.com）

### 3. Database設定

1. Supabase Dashboard → **SQL Editor** で以下を実行:
   ```sql
   -- Edge FunctionのURLを設定
   ALTER DATABASE postgres SET app.send_signup_email_url = 'https://your-project-ref.supabase.co/functions/v1/send-signup-email';
   
   -- オプション: Service Role Keyを設定（セキュリティのため）
   -- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';
   ```

2. マイグレーションファイルを実行:
   ```bash
   supabase db push
   ```

## 動作確認

1. 新規ユーザーを登録
2. 登録完了メールが送信されることを確認

## 注意事項

- Resendの無料プランでは、月間3,000通まで送信可能
- メール送信に失敗しても、ユーザー登録は正常に完了します
- 開発環境では、`RESEND_API_KEY`が設定されていない場合、メール送信はスキップされログに記録されます
