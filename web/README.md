# Test Album LP（Web）

本番・ステージングで同じコードをデプロイし、環境変数で stg/prod を切り替えます。

## ルーティング

| パス | 説明 |
|------|------|
| `/` | トップ |
| `/signup` | 新規登録（Supabase signUp、確認メール送信） |
| `/reset-password` | パスワードリセット（resetPasswordForEmail） |
| `/auth/callback` | 認証コールバック（PKCE: exchangeCodeForSession） |
| `/privacy` | プライバシーポリシー（本番と同じ内容） |
| `/terms` | 利用規約（本番と同じ内容） |

## 環境変数（Vercel）

**必ず `NEXT_PUBLIC_SITE_URL` から redirectTo を組み立てること。**  
メールリンクが www に戻ってしまう場合は、Site URL が www のままか、コードで redirectTo を固定していないか確認してください。

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名鍵（publishable key） |
| `NEXT_PUBLIC_SITE_URL` | この LP のベース URL。**redirectTo は `${NEXT_PUBLIC_SITE_URL}/auth/callback` で組み立てる** |

### ステージング（Vercel Preview / feature/lp-images）

- `NEXT_PUBLIC_SUPABASE_URL` = STG の Supabase URL（例: `https://dzqzkwoxfciuhikvnlmg.supabase.co`）
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = STG の publishable key
- `NEXT_PUBLIC_SITE_URL` = `https://stg.test-album.jp`

### 本番

- `NEXT_PUBLIC_SUPABASE_URL` = PROD の Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = PROD の publishable key
- `NEXT_PUBLIC_SITE_URL` = `https://www.test-album.jp`

## 開発

```bash
cd web
cp .env.example .env.local
# .env.local を編集
npm install
npm run dev
```

## Supabase 側（Redirect URLs）

Auth → URL Configuration の **Redirect URLs** に、stg 用を**追加**（www は消さない）：

- `https://stg.test-album.jp/auth/callback`
- `https://stg.test-album.jp/*`
- （必要なら）`https://stg.test-album.jp/auth/confirmed`

本番用は従来どおり：

- `https://www.test-album.jp/auth/callback`
- `https://www.test-album.jp/*`
