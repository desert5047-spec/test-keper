import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <h1 className="pageTitle">Test Album</h1>
      <p style={{ marginBottom: 24 }}>
        アプリの認証・パスワードリセットは以下のページから行えます。
      </p>
      <p>
        <Link href="/signup" style={{ color: '#4A90E2', marginRight: 16 }}>
          新規登録
        </Link>
        <Link href="/reset-password" style={{ color: '#4A90E2' }}>
          パスワードを忘れた方
        </Link>
      </p>
    </div>
  );
}
