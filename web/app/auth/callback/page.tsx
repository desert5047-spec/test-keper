'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get('code');
      const hashParams = typeof window !== 'undefined' ? window.location.hash : '';

      if (code) {
        // PKCE: code をセッションに交換
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }
        setStatus('ok');
        router.replace('/');
        return;
      }

      // ハッシュで access_token 等が渡る場合（Implicit 等）
      if (hashParams) {
        const { error } = await supabase.auth.getSession();
        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }
        setStatus('ok');
        router.replace('/');
        return;
      }

      setStatus('error');
      setErrorMessage('認証パラメータがありません。メールのリンクから再度お試しください。');
    };

    run();
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div>
        <p>認証を確認しています…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div>
        <div className="message error">{errorMessage}</div>
        <a href="/" className="backLink">
          ← トップへ
        </a>
      </div>
    );
  }

  return (
    <div>
      <p>認証に成功しました。トップへ移動します…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div>認証を確認しています…</div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
