# メール送信が動作しない場合のトラブルシューティング

## 問題: 新規登録時にメールが送信されない

### ⚠️ 重要な問題: カスタムSMTP設定が不完全

**最もよくある原因**: Supabase Dashboardの **Authentication → Emails → SMTP Settings** で **"Enable custom SMTP"** が **ON** になっているのに、必要な設定フィールドが空になっている場合、メールは送信されません。

### 解決方法

#### 方法A: カスタムSMTPを無効化（推奨・簡単）

Supabaseのデフォルトメール機能を使用する場合：

1. **Authentication → Emails → SMTP Settings** に移動
2. **"Enable custom SMTP"** トグルを **OFF** にする
3. これで、Supabaseのデフォルトメールサービスが使用されます

#### 方法B: カスタムSMTPを完全に設定

カスタムSMTPサーバーを使用する場合：

1. **"Enable custom SMTP"** を **ON** のままにする
2. **すべてのフィールドを埋める**:
   - **Sender email address**: 送信元メールアドレス（例: `noreply@yourdomain.com`）
   - **Sender name**: 送信者名（例: `テストキーパー`）
   - **Host**: SMTPサーバーのホスト名（例: `smtp.gmail.com` または `smtp.resend.com`）
   - **Port number**: ポート番号（通常は `465` または `587`）
   - **Username**: SMTPユーザー名
   - **Password**: SMTPパスワード
   - **Minimum interval per user**: ユーザーあたりの最小送信間隔（秒）

### 確認事項

#### 1. Supabase Dashboardの設定確認

**Authentication → Settings** で以下を確認：

- ✅ **Enable email confirmations** が有効になっているか
- ✅ **SMTP settings** が正しく設定されているか（カスタムSMTPを使用している場合）
- ✅ **Email Templates** でメールテンプレートが設定されているか

#### 2. メール確認の設定

Supabaseでは、デフォルトでメール確認が有効になっている場合のみメールが送信されます。

**メール確認を有効にする方法：**

1. Supabase Dashboard → **Authentication** → **Settings**
2. **Enable email confirmations** を有効にする
3. **Email Templates** → **Confirm signup** をカスタマイズ

#### 3. メール確認を無効にしたい場合

メール確認を無効にしている場合、Supabaseは自動的にメールを送信しません。

**解決策：**

- **方法A**: メール確認を有効にして、メールテンプレートを「登録完了メール」に変更
- **方法B**: Database Trigger + Edge Functionを使用（`supabase/migrations/20260126000000_add_signup_email_trigger.sql`）

### 推奨される設定

#### ステップ1: Supabase Dashboardでメール確認を有効化

1. **Authentication** → **Settings**
2. **Enable email confirmations** を **ON** にする
3. **Email Templates** → **Confirm signup** を選択
4. 以下の内容に変更：

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

---

メールアドレスを確認するには、以下のリンクをクリックしてください：
{{ .ConfirmationURL }}

（このリンクをクリックしないと、アカウントが有効化されません）
```

#### ステップ2: メール確認をスキップする場合（開発環境のみ）

開発環境でメール確認をスキップしたい場合は、`contexts/AuthContext.tsx`の`signUp`関数を以下のように変更：

```typescript
const signUp = async (email: string, password: string) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        skip_email_confirmation: true, // 開発環境のみ
      },
    },
  });
  // ...
};
```

**注意**: 本番環境ではセキュリティ上の理由から、メール確認を有効にすることを強く推奨します。

### メールがスパムフォルダに入る場合

1. **SPFレコード**を設定
2. **DKIM**を設定
3. **DMARC**を設定
4. 送信元ドメインの信頼性を向上

詳細は [Supabase Email Settings](https://supabase.com/docs/guides/auth/auth-smtp) を参照してください。

### デバッグ方法

#### 1. Supabase Dashboardでログを確認

**Authentication** → **Users** で、ユーザーのメール確認ステータスを確認

#### 2. ブラウザのコンソールでエラーを確認

開発者ツールのコンソールでエラーメッセージを確認

#### 3. Supabase Dashboardのログを確認

**Logs** → **Auth Logs** でメール送信のログを確認

### よくある問題

#### Q: メール確認を有効にしているのにメールが送信されない

A: 以下を確認してください：
- SMTP設定が正しいか
- メールテンプレートが設定されているか
- スパムフォルダを確認

#### Q: メール確認を無効にしたいが、登録完了メールは送信したい

A: Database Trigger + Edge Functionを使用してください（`supabase/migrations/20260126000000_add_signup_email_trigger.sql`）

#### Q: 開発環境でメールを送信したくない

A: `signUp`関数で`skip_email_confirmation: true`を設定するか、Supabase Dashboardでメール確認を無効にしてください。
