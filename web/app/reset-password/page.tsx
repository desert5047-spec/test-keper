'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase, getAuthCallbackUrl } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const redirectTo = getAuthCallbackUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }
      setMessage({
        type: 'success',
        text: 'リセット用のメールを送信しました。メール内のリンクからパスワードを再設定してください。',
      });
      setEmail('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '送信に失敗しました。',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Link href="/" className="backLink">
        ← トップへ
      </Link>
      <h1 className="pageTitle">パスワードをリセット</h1>
      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? '送信中…' : 'リセット用メールを送信'}
        </button>
      </form>
    </div>
  );
}
