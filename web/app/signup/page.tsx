'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase, getAuthCallbackUrl } from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const redirectTo = getAuthCallbackUrl();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }
      setMessage({
        type: 'success',
        text: '確認メールを送信しました。メール内のリンクから登録を完了してください。',
      });
      setEmail('');
      setPassword('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '登録に失敗しました。',
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
      <h1 className="pageTitle">新規登録</h1>
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
        <div className="formGroup">
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? '送信中…' : '登録する'}
        </button>
      </form>
    </div>
  );
}
