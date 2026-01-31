import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const PENDING_INVITE_KEY = 'pendingInviteToken';

export default function InviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, setActiveFamilyId, refreshSetupStatus } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const inviteToken = useMemo(() => {
    const rawToken = params.token;
    if (Array.isArray(rawToken)) {
      return rawToken[0] ?? '';
    }
    return rawToken ?? '';
  }, [params.token]);

  useEffect(() => {
    if (!inviteToken) {
      return;
    }
    if (!user) {
      AsyncStorage.setItem(PENDING_INVITE_KEY, inviteToken).finally(() => {
        router.replace('/(auth)/login');
      });
    }
  }, [inviteToken, router, user]);

  const getAcceptInviteErrorMessage = (msg: string) => {
    if (msg.includes('invalid_or_expired')) {
      return '招待リンクが無効か期限切れです';
    }
    if (msg.includes('email_mismatch')) {
      return 'この招待リンクは別のメールアドレス宛てです';
    }
    if (msg.includes('email_not_found')) {
      return 'ログイン中のメールアドレスを取得できませんでした';
    }
    return '招待の参加に失敗しました';
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken) {
      setError('招待リンクが正しくありません');
      return;
    }
    if (!user) {
      setError('ログインが必要です');
      router.replace('/(auth)/login');
      return;
    }

    setError('');
    setMessage('');
    setIsAccepting(true);

    const { data, error: acceptError } = await supabase.rpc('accept_invite', {
      invite_token: inviteToken,
    });

    if (acceptError) {
      console.error('[Invite] 招待受諾エラー:', acceptError);
      setError(getAcceptInviteErrorMessage(acceptError.message || ''));
      setIsAccepting(false);
      return;
    }

    const nextFamilyId = data as string | null;
    await AsyncStorage.removeItem(PENDING_INVITE_KEY);
    if (nextFamilyId) {
      setActiveFamilyId(nextFamilyId);
      await refreshSetupStatus();
    }
    setMessage('参加しました');
    setIsAccepting(false);
    router.replace('/onboarding');
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const hasToken = inviteToken.trim().length > 0;
  const showLoading = !user && hasToken;

  return (
    <View style={styles.container}>
      <AppHeader showBack={true} showSettings={false} showChildSwitcher={false} title="家族招待" />
      <View style={styles.content}>
        {showLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.loadingText}>招待情報を確認しています...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {hasToken ? (
              <>
                <Text style={styles.title}>家族に参加しますか？</Text>
                <Text style={styles.description}>
                  招待リンクの内容を確認し、参加ボタンを押してください。
                </Text>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {message ? <Text style={styles.successText}>{message}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryButton, isAccepting && styles.primaryButtonDisabled]}
                  onPress={handleAcceptInvite}
                  disabled={isAccepting}
                  activeOpacity={0.7}>
                  {isAccepting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>参加する</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleGoHome} activeOpacity={0.7}>
                  <Text style={styles.secondaryButtonText}>ホームに戻る</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.title}>招待リンクが見つかりません</Text>
                <Text style={styles.description}>
                  正しい招待リンクからアクセスしてください。
                </Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleGoHome} activeOpacity={0.7}>
                  <Text style={styles.secondaryButtonText}>ホームに戻る</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  content: {
    flex: 1,
    paddingTop: 108,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#E74C3C',
    marginBottom: 8,
  },
  successText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#27AE60',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#fff',
  },
  secondaryButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
});
