import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { log } from '@/lib/logger';

type CallbackStatus = 'processing' | 'ready' | 'error';

export default function WebAuthCallback() {
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [debugUrl, setDebugUrl] = useState('');
  const [debugHash, setDebugHash] = useState('');
  const [debugSearch, setDebugSearch] = useState('');
  const [debugType, setDebugType] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

  useEffect(() => {
    if (!isWeb) {
      setStatus('error');
      setErrorMessage('このページはWeb環境でのみ利用できます。');
      return;
    }

    const url = window.location.href;
    setDebugUrl(url);
    log('[AuthCallbackWeb] opened:', window.location.origin + window.location.pathname);

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    setDebugHash(window.location.hash || '(空)');
    setDebugSearch(window.location.search || '(空)');

    const pick = (key: string) => hashParams.get(key) || searchParams.get(key) || '';
    const accessToken = pick('access_token');
    const refreshToken = pick('refresh_token');
    const code = pick('code');
    const type = pick('type');
    const token = pick('token');
    const error = pick('error');
    const errorDescription = pick('error_description');

    const info: string[] = [];
    if (accessToken) info.push('access_token');
    if (refreshToken) info.push('refresh_token');
    if (code) info.push('code');
    if (type) info.push(`type=${type}`);
    if (token) info.push('token');
    if (error) info.push(`error=${error}`);
    if (errorDescription) info.push(`error_description=${errorDescription}`);
    setDebugInfo(info);
    setDebugType(type || '(未検出)');

    if (!accessToken && !code && !token && !error) {
      setStatus('error');
      setErrorMessage('トークン/コードが見つかりません。リンクが期限切れの可能性があります。');
      return;
    }

    const nextParams = new URLSearchParams();
    if (accessToken) nextParams.set('access_token', accessToken);
    if (refreshToken) nextParams.set('refresh_token', refreshToken);
    if (code) nextParams.set('code', code);
    if (type) nextParams.set('type', type);
    if (token) nextParams.set('token', token);
    if (error) nextParams.set('error', error);
    if (errorDescription) nextParams.set('error_description', errorDescription);

    const nextLink = `testalbum:///auth-callback${nextParams.toString() ? `?${nextParams}` : ''}`;
    setDeepLink(nextLink);
    setStatus('ready');

    const timer = setTimeout(() => {
      try {
        window.location.href = nextLink;
      } catch (err) {
        setStatus('error');
        setErrorMessage('アプリへの遷移に失敗しました。');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isWeb]);

  const statusText = useMemo(() => {
    if (status === 'processing') return '処理中...';
    if (status === 'ready') return 'アプリを開こうとしています...';
    return 'エラーが発生しました。';
  }, [status]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>認証コールバック</Text>
      <Text style={styles.status}>{statusText}</Text>

      {status === 'error' && !!errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}

      {deepLink ? (
        isWeb ? (
          <a
            href={deepLink}
            onClick={(event) => {
              event.preventDefault();
              window.location.assign(deepLink);
            }}
            style={{
              display: 'inline-block',
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 8,
              backgroundColor: '#111',
              marginBottom: 16,
              color: '#fff',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            アプリを開く
          </a>
        ) : (
          <TouchableOpacity
            style={styles.openButton}
            onPress={() => {
              if (isWeb) window.location.assign(deepLink);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.openButtonText}>アプリを開く</Text>
          </TouchableOpacity>
        )
      ) : null}

      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>デバッグ情報</Text>
        <Text style={styles.debugLabel}>開いたURL</Text>
        <Text style={styles.debugValue}>{debugUrl || '(空)'}</Text>
        <Text style={styles.debugLabel}>hash</Text>
        <Text style={styles.debugValue}>{debugHash || '(空)'}</Text>
        <Text style={styles.debugLabel}>search</Text>
        <Text style={styles.debugValue}>{debugSearch || '(空)'}</Text>
        <Text style={styles.debugLabel}>検出した type</Text>
        <Text style={styles.debugValue}>{debugType || '(未検出)'}</Text>
        <Text style={styles.debugLabel}>検出パラメータ</Text>
        <Text style={styles.debugValue}>{debugInfo.length ? debugInfo.join(', ') : '(なし)'}</Text>
        <Text style={styles.debugLabel}>遷移先</Text>
        <Text style={styles.debugValue}>{deepLink || '(未生成)'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
  },
  status: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  errorText: {
    color: '#c00',
    marginBottom: 12,
  },
  openButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#111',
    marginBottom: 16,
  },
  openButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  debugBox: {
    width: '100%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  debugTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  debugLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  debugValue: {
    fontSize: 12,
    color: '#111',
  },
});
