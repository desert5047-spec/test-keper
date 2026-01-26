# 正しいメールテンプレート設定

## 現在の問題

「Confirm signup」テンプレートに `{{ .ConfirmationURL }}` が含まれていないため、ユーザーがメールアドレスを確認できません。

## 正しい設定

### メール確認を有効にする場合（推奨）

**Authentication → Email Templates → Confirm signup** に以下の内容を設定：

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

**重要**: `{{ .ConfirmationURL }}` は必須です。これがないと、ユーザーはアカウントを確認できません。

### メール確認を無効にする場合

メール確認を無効にしている場合、「Confirm signup」テンプレートは使用されません。

登録完了メールを送信したい場合は、Database Trigger + Edge Functionを使用してください（`supabase/migrations/20260126000000_add_signup_email_trigger.sql`）。

## 設定の確認

1. **Authentication → Settings** で「Enable email confirmations」の状態を確認
2. **ON** の場合: 上記のテンプレートに `{{ .ConfirmationURL }}` を追加
3. **OFF** の場合: Database Trigger + Edge Functionを使用
