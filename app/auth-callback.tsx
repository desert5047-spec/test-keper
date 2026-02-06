import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { setHandlingAuthCallback } from '@/lib/authCallbackState';

type SessionStatus = 'processing' | 'success' | 'error';

const safeDecode = (value: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseAuthParams = (url: string) => {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryPart = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';
  const hashParams = new URLSearchParams(hashPart);
  const queryParams = new URLSearchParams(queryPart);
  const pick = (key: string) => hashParams.get(key) || queryParams.get(key) || '';

  return {
    accessToken: safeDecode(pick('access_token')),
    refreshToken: safeDecode(pick('refresh_token')),
    code: safeDecode(pick('code')),
    type: safeDecode(pick('type')),
    token: safeDecode(pick('token')),
  };
};

export default function AuthCallbackDeepLink() {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>('processing');
  const [message, setMessage] = useState('');
  const [receivedUrl, setReceivedUrl] = useState('');
  const [detectedType, setDetectedType] = useState('');
  const [sessionStatus, setSessionStatus] = useState('未確認');
  const [sessionUserId, setSessionUserId] = useState('');
  const [tokenLengths, setTokenLengths] = useState({
    urlLen: 0,
    accessLen: 0,
    refreshLen: 0,
    codeLen: 0,
  });

  const maskUrl = (url: string) => {
    if (!url) return '';
    return url
      .replace(/access_token=[^&]+/g, 'access_token=***')
      .replace(/refresh_token=[^&]+/g, 'refresh_token=***')
      .replace(/code=[^&]+/g, 'code=***')
      .replace(/token=[^&]+/g, 'token=***');
  };

  const handleUrl = async (url: string) => {
    console.warn('[AuthCallback] deep link received:', url);
    setReceivedUrl(maskUrl(url));
    const { accessToken, refreshToken, code, type } = parseAuthParams(url);
    setDetectedType(type || '(未検出)');
    setTokenLengths({
      urlLen: url.length,
      accessLen: accessToken?.length ?? 0,
      refreshLen: refreshToken?.length ?? 0,
      codeLen: code?.length ?? 0,
    });

    try {
      setHandlingAuthCallback(true);
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setStatus('error');
          setMessage(`setSession エラー: ${error.message}`);
          return;
        }
        setStatus('success');
        setMessage('setSession 成功');
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus('error');
          setMessage(`exchangeCodeForSession エラー: ${error.message}`);
          return;
        }
        setStatus('success');
        setMessage('exchangeCodeForSession 成功');
      }

      if (!accessToken && !refreshToken && !code) {
        setStatus('error');
        setMessage('トークン/コードが見つかりません。');
        return;
      }

      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session?.user;
      setSessionStatus(hasSession ? 'OK' : '未確立');
      setSessionUserId(data.session?.user?.id ?? '');

      if (type === 'recovery') {
        setHandlingAuthCallback(false);
        router.replace('/(auth)/reset-password');
        return;
      }
      setHandlingAuthCallback(false);
      router.replace('/(tabs)');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '不明なエラー';
      setStatus('error');
      setMessage(`処理エラー: ${messageText}`);
    } finally {
      setHandlingAuthCallback(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'web') {
        setStatus('error');
        setMessage('このページはアプリ内でのみ利用できます。');
        return;
      }

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleUrl(initialUrl);
      } else {
        setStatus('error');
        setMessage('深いリンクが取得できませんでした。');
      }
    };

    init();

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  const statusText = useMemo(() => {
    if (status === 'processing') return 'セッションを確認中...';
    if (status === 'success') return 'セッション確立済み';
    return 'エラーが発生しました';
  }, [status]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>認証処理</Text>
        <Text style={styles.status}>{statusText}</Text>
        {status === 'processing' ? (
          <ActivityIndicator size="small" color="#333" />
        ) : null}
        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>デバッグ</Text>
          <Text style={styles.debugLabel}>受信URL（伏字）</Text>
          <Text style={styles.debugValue}>{receivedUrl || '(未取得)'}</Text>
          <Text style={styles.debugLabel}>検出した type</Text>
          <Text style={styles.debugValue}>{detectedType || '(未検出)'}</Text>
          <Text style={styles.debugLabel}>文字数</Text>
          <Text style={styles.debugValue}>
            urlLen={tokenLengths.urlLen} / accessLen={tokenLengths.accessLen} / refreshLen={tokenLengths.refreshLen} / codeLen={tokenLengths.codeLen}
          </Text>
          <Text style={styles.debugLabel}>getSession 結果</Text>
          <Text style={styles.debugValue}>
            {sessionStatus}{sessionUserId ? ` (user=${sessionUserId})` : ''}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111',
  },
  status: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: '#444',
    marginTop: 6,
  },
  debugBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  debugTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  debugLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  debugValue: {
    fontSize: 12,
    color: '#111',
  },
});
