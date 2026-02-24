import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Test Album',
  description: 'Test Album',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="layout">
          <main className="main">{children}</main>
          <footer className="footer">
            <Link href="/signup">新規登録</Link>
            <span className="sep">|</span>
            <Link href="/reset-password">パスワードを忘れた方</Link>
            <span className="sep">|</span>
            <Link href="/privacy">プライバシーポリシー</Link>
            <span className="sep">|</span>
            <Link href="/terms">利用規約</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
