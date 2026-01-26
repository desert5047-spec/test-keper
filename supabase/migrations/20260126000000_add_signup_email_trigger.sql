-- 新規登録完了メール送信のためのトリガーと関数
-- このマイグレーションは、ユーザーが新規登録した際に自動的に登録完了メールを送信します

-- ===========================
-- 1. pg_net拡張機能の有効化（HTTPリクエスト送信用）
-- ===========================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ===========================
-- 2. メール送信関数（Edge Function呼び出し用）
-- ===========================
CREATE OR REPLACE FUNCTION send_signup_email()
RETURNS TRIGGER AS $$
DECLARE
  email_text text;
  email_html text;
  webhook_url text;
BEGIN
  -- Edge FunctionのURL（Supabase Dashboardで設定したURLに置き換えてください）
  -- 例: https://your-project-ref.supabase.co/functions/v1/send-signup-email
  webhook_url := current_setting('app.send_signup_email_url', true);
  
  -- webhook_urlが設定されていない場合は、ログに記録して終了
  IF webhook_url IS NULL OR webhook_url = '' THEN
    RAISE NOTICE 'send_signup_email_url is not configured. Skipping email send.';
    RETURN NEW;
  END IF;

  -- HTMLメール本文
  email_html := format('
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4A90E2; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>テストキーパー</h1>
        </div>
        <div class="content">
          <h2>ご登録ありがとうございます！</h2>
          <p>%s 様</p>
          <p>この度は、テストキーパーにご登録いただき、誠にありがとうございます。</p>
          <p>アカウントの登録が完了いたしました。以下の機能をご利用いただけます：</p>
          <ul>
            <li>テスト結果の記録と管理</li>
            <li>画像付きでの記録保存</li>
            <li>月次統計の確認</li>
            <li>目標設定と達成状況の追跡</li>
          </ul>
          <p>アプリを開いて、お子様の頑張りを記録していきましょう！</p>
          <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
          <p>今後ともテストキーパーをよろしくお願いいたします。</p>
        </div>
      </div>
    </body>
    </html>
  ', COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- テキストメール本文
  email_text := format('
ご登録ありがとうございます！

%s 様

この度は、テストキーパーにご登録いただき、誠にありがとうございます。

アカウントの登録が完了いたしました。以下の機能をご利用いただけます：

- テスト結果の記録と管理
- 画像付きでの記録保存
- 月次統計の確認
- 目標設定と達成状況の追跡

アプリを開いて、お子様の頑張りを記録していきましょう！

ご不明な点がございましたら、お気軽にお問い合わせください。

今後ともテストキーパーをよろしくお願いいたします。
  ', COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- Edge Functionを呼び出してメール送信
  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'to', NEW.email,
      'subject', 'テストキーパーへのご登録ありがとうございます',
      'html', email_html,
      'text', email_text
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- エラーが発生してもユーザー作成は続行
    RAISE WARNING 'Failed to send signup email: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================
-- 3. トリガーの作成
-- ===========================
-- auth.usersテーブルに新しいユーザーが作成されたときにメール送信関数を呼び出す
DROP TRIGGER IF EXISTS trigger_send_signup_email ON auth.users;
CREATE TRIGGER trigger_send_signup_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS NOT NULL)
  EXECUTE FUNCTION send_signup_email();

-- ===========================
-- 注意事項
-- ===========================
-- 1. Supabase Dashboardで以下の設定が必要です：
--    - Edge Functionを作成: supabase/functions/send-signup-email/
--    - 環境変数に app.send_signup_email_url を設定
--    - 環境変数に app.service_role_key を設定（オプション、セキュリティのため）
--
-- 2. または、より簡単な方法として、Supabase Dashboardの「Authentication」→「Email Templates」
--    で「Confirm signup」テンプレートをカスタマイズすることもできます。
--
-- 3. この実装では、pg_net拡張機能を使用してEdge Functionを呼び出します。
--    Edge Functionが設定されていない場合は、メール送信はスキップされます。
