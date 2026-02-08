import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { setHandlingAuthCallback, startBootHold } from '@/lib/authCallbackState';

type SessionStatus = 'processing' | 'success' | 'error';

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseKeyValues = (input: string) => {
  const result: Record<string, string> = {};
  if (!input) return result;
  const pairs = input.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) continue;
    const key = rawKey;
    const rawValue = rest.join('=').replace(/\+/g, '%20');
    const value = safeDecode(rawValue);
    result[key] = value;
  }
  return result;
};

const parseAuthParams = (url: string) => {
  const parsed = Linking.parse(url);
  const queryParams = (parsed.queryParams ?? {}) as Record<string, string | number | boolean>;
  const hashIndex = url.indexOf('#');
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const hashParams = parseKeyValues(hashPart);
  const pick = (key: string) => {
    const queryValue = queryParams[key];
    if (queryValue !== undefined && queryValue !== null) {
      return String(queryValue);
    }
    return hashParams[key] ?? '';
  };

  return {
    accessToken: pick('access_token'),
    refreshToken: pick('refresh_token'),
    code: pick('code'),
    type: pick('type'),
    debug: pick('debug'),
  };
};

const pickParam = (value: string | string[] | undefined) => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] ?? '' : value;
};

export default function AuthCallbackDeepLink() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<SessionStatus>('processing');
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<'routerParams' | 'linkingEvent' | 'none'>('none');
  const [accessLen, setAccessLen] = useState(0);
  const [refreshLen, setRefreshLen] = useState(0);
  const [codeLen, setCodeLen] = useState(0);
  const [type, setType] = useState('');
  const [sessionUserId, setSessionUserId] = useState('');
  const [setSessionStatus, setSetSessionStatus] = useState('');
  const [exchangeStatus, setExchangeStatus] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const hasProcessedRef = useRef(false);
  const isMountedRef = useRef(true);
  const waitRouterParamsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const overallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOverallTimer = () => {
    if (overallTimerRef.current) {
      clearTimeout(overallTimerRef.current);
      overallTimerRef.current = null;
    }
    startedAtRef.current = 0;
  };

  const clearGuardTimer = () => {
    if (guardTimerRef.current) {
      clearTimeout(guardTimerRef.current);
      guardTimerRef.current = null;
    }
  };

  const makeTimeout = (label: string, ms = 6000) => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const promise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    });
    const cancel = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };
    return { promise, cancel };
  };

  const processAuth = async (input: {
    accessToken: string;
    refreshToken: string;
    code: string;
    type: string;
    debug: string;
    source: 'routerParams' | 'linkingEvent';
  }) => {
    if (hasProcessedRef.current) return;

    const accessToken = input.accessToken;
    const refreshToken = input.refreshToken;
    const code = input.code;
    const detectedType = input.type;
    const isDebug = input.debug === '1';

    if (!isDebug && !accessToken && !refreshToken && !code && !detectedType) {
      if (input.source === 'routerParams') {
        if (!isMountedRef.current) return;
        setStatus('error');
        setMessage('リンクが無効です。');
      }
      return;
    }

    hasProcessedRef.current = true;
    if (isMountedRef.current) {
      setSource(input.source);
    }

    const scheduleFailureReturn = () => {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        router.replace('/(auth)/login');
      }, 1000);
    };

    try {
      setHandlingAuthCallback(true);
      startBootHold(8000);
      if (!startedAtRef.current && !overallTimerRef.current) {
        startedAtRef.current = Date.now();
        overallTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          setStatus('error');
          setMessage('タイムアウトしました。ログイン画面へ戻ります。');
          setErrorDetail('overall timeout');
          setHandlingAuthCallback(false);
          clearOverallTimer();
          router.replace('/(auth)/login');
        }, 12000);
      }
      if (isMountedRef.current) {
        setAccessLen(accessToken.length);
        setRefreshLen(refreshToken.length);
        setCodeLen(code.length);
        setType(detectedType || '(未検出)');
      }

      if (isDebug) {
        if (!isMountedRef.current) return;
        setStatus('success');
        setMessage('DEBUG: bypass session');
        clearGuardTimer();
        if (detectedType === 'recovery') {
          clearOverallTimer();
          setTimeout(() => {
            if (!isMountedRef.current) return;
            router.replace('/(auth)/reset-password?debug=1');
          }, 500);
          return;
        }
        clearOverallTimer();
        setTimeout(() => {
          if (!isMountedRef.current) return;
          router.replace('/(tabs)');
        }, 500);
        return;
      }

      if (code) {
        if (isMountedRef.current) {
          setExchangeStatus('exchangeCodeForSession start');
        }
        let timeout = makeTimeout('exchangeCodeForSession');
        try {
          const { error } = await Promise.race([
            supabase.auth.exchangeCodeForSession(code),
            timeout.promise,
          ]);
          if (error) {
            if (isMountedRef.current) {
              setStatus('error');
              setMessage(`exchangeCodeForSession エラー: ${error.message}`);
              setErrorDetail(`${error.name || 'Error'}: ${error.message}`);
            }
            scheduleFailureReturn();
            return;
          }
          if (isMountedRef.current) {
            setExchangeStatus('exchangeCodeForSession end');
          }
        } catch (error) {
          const messageText = error instanceof Error ? error.message : 'exchangeCodeForSession timeout';
          if (isMountedRef.current) {
            setExchangeStatus('timeout');
            setStatus('error');
            setMessage(messageText);
            setErrorDetail(messageText);
          }
          scheduleFailureReturn();
          return;
        } finally {
          timeout.cancel();
        }
      } else if (accessToken) {
        if (isMountedRef.current) {
          setSetSessionStatus('setSession start');
        }
        let timeout = makeTimeout('setSession');
        try {
          const { error } = await Promise.race([
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            timeout.promise,
          ]);
          if (error) {
            if (isMountedRef.current) {
              setStatus('error');
              setMessage(`setSession エラー: ${error.message}`);
              setErrorDetail(`${error.name || 'Error'}: ${error.message}`);
            }
            scheduleFailureReturn();
            return;
          }
          if (isMountedRef.current) {
            setSetSessionStatus('setSession end');
          }
        } catch (error) {
          const messageText = error instanceof Error ? error.message : 'setSession timeout';
          if (isMountedRef.current) {
            setSetSessionStatus('timeout');
            setStatus('error');
            setMessage(messageText);
            setErrorDetail(messageText);
          }
          scheduleFailureReturn();
          return;
        } finally {
          timeout.cancel();
        }
      } else {
        if (isMountedRef.current) {
          setStatus('error');
          setMessage('コード/トークンが見つかりません。ログイン画面へ戻ります。');
          setErrorDetail('Error: missing code/token');
        }
        scheduleFailureReturn();
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (isMountedRef.current) {
          setSessionUserId(data.session?.user?.id ?? '');
        }
      } catch {
        if (isMountedRef.current) {
          setSessionUserId('');
        }
      }

      if (!isMountedRef.current) return;
      setStatus('success');
      setMessage('セッションを確立しました。');
      clearGuardTimer();
      if (detectedType === 'recovery') {
        clearOverallTimer();
        setTimeout(() => {
          if (!isMountedRef.current) return;
          router.replace('/(auth)/reset-password');
        }, 500);
        return;
      }
      clearOverallTimer();
      setTimeout(() => {
        if (!isMountedRef.current) return;
        router.replace('/(tabs)');
      }, 500);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '不明なエラー';
      if (isMountedRef.current) {
        setStatus('error');
        setMessage(`処理エラー: ${messageText}`);
        setErrorDetail(error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown');
      }
      hasProcessedRef.current = false;
      scheduleFailureReturn();
    } finally {
      setHandlingAuthCallback(false);
      clearGuardTimer();
      clearOverallTimer();
    }
  };

  const handleUrl = async (url: string) => {
    try {
      const { accessToken, refreshToken, code, type: detectedType, debug } = parseAuthParams(url);
      await processAuth({
        accessToken,
        refreshToken,
        code,
        type: detectedType,
        debug,
        source: 'linkingEvent',
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      setStatus('error');
      setMessage('例外が発生しました');
      setErrorDetail(detail);
    }
  };

  const handleParams = async (input: {
    accessToken: string;
    refreshToken: string;
    code: string;
    type: string;
    debug: string;
  }) => {
    await processAuth({
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      code: input.code,
      type: input.type,
      debug: input.debug,
      source: 'routerParams',
    });
  };

  const accessToken = pickParam(params.access_token as string | string[] | undefined);
  const refreshToken = pickParam(params.refresh_token as string | string[] | undefined);
  const code = pickParam(params.code as string | string[] | undefined);
  const detectedType = pickParam(params.type as string | string[] | undefined);
  const debug = pickParam(params.debug as string | string[] | undefined);

  useEffect(() => {
    isMountedRef.current = true;

    if (waitRouterParamsRef.current) {
      clearTimeout(waitRouterParamsRef.current);
      waitRouterParamsRef.current = null;
    }
    clearGuardTimer();

    guardTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setHandlingAuthCallback(false);
      clearOverallTimer();
      router.replace('/(auth)/login');
    }, 5000);

    const run = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && !hasProcessedRef.current) {
          await handleUrl(initialUrl);
          return;
        }
      } catch {
        // 取得失敗時はフォールバックへ
      }

      if (hasProcessedRef.current) return;

      if (accessToken || code || detectedType) {
        await handleParams({ accessToken, refreshToken, code, type: detectedType, debug });
      } else {
        waitRouterParamsRef.current = setTimeout(() => {
          if (!hasProcessedRef.current) {
            setStatus('error');
            setMessage('リンクが無効です。');
          }
        }, 800);
      }
    };

    run();

    const onUrl = async (event: { url: string }) => {
      if (!event.url) return;
      if (hasProcessedRef.current) return;
      if (waitRouterParamsRef.current) {
        clearTimeout(waitRouterParamsRef.current);
        waitRouterParamsRef.current = null;
      }
      await handleUrl(event.url);
    };

    const subscription = Linking.addEventListener('url', onUrl);

    return () => {
      isMountedRef.current = false;
      if (waitRouterParamsRef.current) {
        clearTimeout(waitRouterParamsRef.current);
        waitRouterParamsRef.current = null;
      }
      clearGuardTimer();
      clearOverallTimer();
      subscription.remove();
    };
  }, [accessToken, refreshToken, code, detectedType, debug]);

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
          <Text style={styles.debugLabel}>source</Text>
          <Text style={styles.debugValue}>{source}</Text>
          <Text style={styles.debugLabel}>accessLen</Text>
          <Text style={styles.debugValue}>{accessLen}</Text>
          <Text style={styles.debugLabel}>refreshLen</Text>
          <Text style={styles.debugValue}>{refreshLen}</Text>
          <Text style={styles.debugLabel}>codeLen</Text>
          <Text style={styles.debugValue}>{codeLen}</Text>
          <Text style={styles.debugLabel}>type</Text>
          <Text style={styles.debugValue}>{type || '(未検出)'}</Text>
          <Text style={styles.debugLabel}>setSession</Text>
          <Text style={styles.debugValue}>{setSessionStatus || '(none)'}</Text>
          <Text style={styles.debugLabel}>exchangeCodeForSession</Text>
          <Text style={styles.debugValue}>{exchangeStatus || '(none)'}</Text>
          <Text style={styles.debugLabel}>sessionUserId</Text>
          <Text style={styles.debugValue}>{sessionUserId || '(none)'}</Text>
          <Text style={styles.debugLabel}>error</Text>
          <Text style={styles.debugValue}>{errorDetail || '(none)'}</Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text
            onPress={() => {
              setHandlingAuthCallback(false);
              hasProcessedRef.current = false;
              clearOverallTimer();
              router.replace('/(auth)/login');
            }}
            style={{ color: '#2563eb', fontWeight: '700' }}
          >
            ログインへ戻る
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
