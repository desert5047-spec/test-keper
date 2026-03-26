import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, useHeaderTop } from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getLpUrl } from '@/lib/lpUrl';
import { warn, error as logError } from '@/lib/logger';

export default function InviteScreen() {
  const headerTop = useHeaderTop();
  const { user, familyId, isFamilyReady } = useAuth();

  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [familyRole, setFamilyRole] = useState<'owner' | 'member' | null>(null);

  const isOwner = familyRole === 'owner';

  const loadRole = useCallback(async () => {
    if (!user?.id || !isFamilyReady || !familyId) {
      setFamilyRole(null);
      return;
    }
    const { data } = await supabase
      .from('family_members')
      .select('role')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .maybeSingle();
    setFamilyRole((data?.role as 'owner' | 'member') ?? null);
  }, [user?.id, isFamilyReady, familyId]);

  useEffect(() => {
    loadRole();
  }, [loadRole]);

  const copyToClipboard = async (text: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      return true;
    } catch {
      warn('[Invite] クリップボードコピー失敗');
      return false;
    }
  };

  const handleCreate = async () => {
    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }
    if (!isFamilyReady || !familyId) {
      setError('家族情報の取得中です。少し待ってから再度お試しください');
      return;
    }

    setError('');
    setMessage('');
    setInviteUrl('');
    setLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('create_invite', {
        invited_email: email.trim(),
      });

      if (rpcError) {
        logError('[Invite] 招待作成エラー');
        const msg = rpcError.message || '';
        setError(msg.includes('owner_only') ? 'オーナーのみ招待を作成できます' : '招待の作成に失敗しました');
        return;
      }

      const token = data ?? '';
      if (token) {
        const url = getLpUrl(`/invite?token=${encodeURIComponent(token)}`);
        setInviteUrl(url);
        setMessage('招待リンクを作成しました');
      }
    } catch {
      setError('招待の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    const ok = await copyToClipboard(inviteUrl);
    if (ok) {
      setMessage('招待リンクをコピーしました');
    } else {
      setError('コピーに失敗しました');
    }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    const shareText =
      'テストアルバムの家族招待です。以下のリンクを開き、ログインまたは新規登録後に参加してください（リンク有効期限: 1時間）\n\n' +
      inviteUrl;

    if (Platform.OS === 'web') {
      const canShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ text: shareText });

      if (canShare) {
        try {
          await navigator.share({ text: shareText });
          setMessage('招待リンクを共有しました');
          return;
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
        }
      }

      const ok = await copyToClipboard(inviteUrl);
      if (ok) {
        setMessage('招待リンクをコピーしました');
      } else {
        setError('コピーに失敗しました');
      }
      return;
    }

    try {
      await Share.share({ message: shareText });
      setMessage('招待リンクを共有しました');
    } catch {
      const ok = await copyToClipboard(inviteUrl);
      if (ok) {
        setMessage('招待リンクをコピーしました');
      } else {
        setError('共有とコピーに失敗しました');
      }
    }
  };

  if (familyRole !== null && !isOwner) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={styles.container}>
          <AppHeader showBack showSettings={false} showChildSwitcher={false} title="家族を招待" safeTopByParent />
          <View style={[styles.center, { paddingTop: headerTop + 40 }]}>
            <Text style={styles.infoText}>招待を作成できるのは管理者のみです</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={styles.container}>
        <AppHeader showBack showSettings={false} showChildSwitcher={false} title="家族を招待" safeTopByParent />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerTop + 4 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>家族に招待リンクを共有します</Text>
            <Text style={styles.cardDescription}>
              受け取った方はWebでログインまたは新規登録後に参加できます。{'\n'}
              リンクの有効期限は1時間です。
            </Text>

            <TextInput
              style={styles.input}
              placeholder="招待するメールアドレス"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError('');
              }}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>招待リンクを作成</Text>
              )}
            </TouchableOpacity>

            {inviteUrl ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>招待リンク</Text>
                <Text style={styles.resultUrl} numberOfLines={2} selectable>
                  {inviteUrl}
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleCopy} activeOpacity={0.7}>
                    <Text style={styles.secondaryButtonText}>コピー</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleShare} activeOpacity={0.7}>
                    <Text style={styles.secondaryButtonText}>共有する</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
    marginBottom: 12,
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
    borderRadius: 10,
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
  resultBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultLabel: {
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
    color: '#6B7280',
    marginBottom: 6,
  },
  resultUrl: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#4A90E2',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#4A90E2',
  },
});
