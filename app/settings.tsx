import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Users, ChevronRight, Home, List, Plus, Calendar, Trash2, LogOut, FileText, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppHeader } from '@/components/AppHeader';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { children, loadChildren } = useChild();
  const {
    signOut,
    user,
    familyId,
    isFamilyReady,
    familyDisplayName,
    refreshFamilyDisplayName,
    refreshSetupStatus,
    setActiveFamilyId,
  } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [familyRole, setFamilyRole] = useState<'owner' | 'member' | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteList, setInviteList] = useState<
    { token: string; email: string; created_at: string; expires_at: string | null; status: string }[]
  >([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [acceptToken, setAcceptToken] = useState('');
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState('');
  const [acceptError, setAcceptError] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [displayNameMessage, setDisplayNameMessage] = useState('');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

  const isOwner = familyRole === 'owner';
  const displayNameValue = displayNameInput.trim();
  const remainingChars = 4 - displayNameValue.length;
  const isDisplayNameValid = displayNameValue.length >= 1 && displayNameValue.length <= 4;
  const isDisplayNameUnchanged =
    displayNameValue === (familyDisplayName ?? '') ||
    (!familyDisplayName && displayNameValue === '');

  const getCreateInviteErrorMessage = (message: string) => {
    if (message.includes('owner_only')) {
      return 'オーナーのみ招待を作成できます';
    }
    return '招待の作成に失敗しました';
  };

  const getAcceptInviteErrorMessage = (message: string) => {
    if (message.includes('invalid_or_expired')) {
      return '招待コードが無効か期限切れです';
    }
    if (message.includes('email_mismatch')) {
      return 'この招待コードは別のメールアドレス宛てです';
    }
    if (message.includes('email_not_found')) {
      return 'ログイン中のメールアドレスを取得できませんでした';
    }
    return '招待の受諾に失敗しました';
  };

  const performResetData = async () => {
    setIsResetting(true);
    try {
      if (!user?.id) {
        throw new Error('ユーザー情報が見つかりません');
      }
      if (!isFamilyReady || !familyId) {
        throw new Error('家族情報の取得中です。少し待ってから再度お試しください');
      }

      const { data: records } = await supabase
        .from('records')
        .select('photo_uri')
        .eq('family_id', familyId)
        .not('photo_uri', 'is', null);

      if (records && records.length > 0) {
        const { data: listData } = await supabase.storage
          .from('test-images')
          .list(user.id);

        if (listData && listData.length > 0) {
          const allUserFiles = listData.map(file => `${user.id}/${file.name}`);
          await supabase.storage.from('test-images').remove(allUserFiles);
        }
      }

      await supabase
        .from('subjects')
        .delete()
        .eq('user_id', user.id);

      const { error: childrenError } = await supabase
        .from('children')
        .delete()
        .eq('family_id', familyId);

      if (childrenError) {
        throw new Error('初期化に失敗しました: ' + childrenError.message);
      }

      await AsyncStorage.removeItem('hasCompletedOnboarding');
      await loadChildren();

      if (Platform.OS === 'web') {
        window.alert('すべてのデータを削除しました');
        router.replace('/onboarding');
      } else {
        Alert.alert('初期化完了', 'すべてのデータを削除しました', [
          { text: 'OK', onPress: () => router.replace('/onboarding') },
        ]);
      }
    } catch (err: any) {
      const msg = err?.message || '不明なエラー';
      if (Platform.OS === 'web') {
        window.alert('エラー: ' + msg);
      } else {
        Alert.alert('エラー', msg);
      }
    } finally {
      setIsResetting(false);
    }
  };

  const loadFamilyRole = useCallback(async () => {
    if (!user?.id || !isFamilyReady || !familyId) {
      setFamilyRole(null);
      return;
    }

    const { data, error } = await supabase
      .from('family_members')
      .select('role')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[Settings] family role 取得エラー:', error);
      setFamilyRole(null);
      return;
    }

    setFamilyRole((data?.role as 'owner' | 'member') ?? null);
  }, [user?.id, isFamilyReady, familyId]);

  const loadInvites = useCallback(async () => {
    if (!isOwner) return;
    setIsLoadingInvites(true);
    const { data, error } = await supabase.rpc('list_invites');
    if (error) {
      console.error('[Settings] 招待一覧取得エラー:', error);
      setInviteList([]);
    } else {
      setInviteList(data ?? []);
    }
    setIsLoadingInvites(false);
  }, [isOwner]);

  useEffect(() => {
    loadFamilyRole();
  }, [loadFamilyRole]);

  useEffect(() => {
    if (isOwner) {
      loadInvites();
    }
  }, [isOwner, loadInvites]);

  const copyToClipboard = async (text: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      return true;
    } catch (error) {
      console.warn('[Settings] クリップボードコピー失敗:', error);
      return false;
    }
  };

  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('メールアドレスを入力してください');
      return;
    }
    if (!isFamilyReady || !familyId) {
      setInviteError('家族情報の取得中です。少し待ってから再度お試しください');
      return;
    }
    setInviteError('');
    setInviteMessage('');
    setInviteToken('');
    setIsCreatingInvite(true);

    const { data, error } = await supabase.rpc('create_invite', {
      invited_email: inviteEmail.trim(),
    });

    if (error) {
      console.error('[Settings] 招待作成エラー:', error);
      setInviteError(getCreateInviteErrorMessage(error.message || ''));
    } else {
      setInviteToken(data ?? '');
      setInviteMessage('招待コードを作成しました');
      loadInvites();
    }

    setIsCreatingInvite(false);
  };

  const handleCopyToken = async () => {
    if (!inviteToken) return;
    const ok = await copyToClipboard(inviteToken);
    if (ok) {
      setInviteMessage('招待コードをコピーしました');
    } else {
      setInviteError('コピーに失敗しました。手動でコピーしてください。');
    }
  };

  const handleAcceptInvite = async () => {
    if (!acceptToken.trim()) {
      setAcceptError('招待コードを入力してください');
      return;
    }
    setAcceptError('');
    setAcceptMessage('');
    setIsAcceptingInvite(true);

    const { data, error } = await supabase.rpc('accept_invite', {
      invite_token: acceptToken.trim(),
    });

    if (error) {
      console.error('[Settings] 招待受諾エラー:', error);
      setAcceptError(getAcceptInviteErrorMessage(error.message || ''));
    } else {
      const nextFamilyId = data as string | null;
      setAcceptMessage('参加しました');
      setAcceptToken('');
      if (nextFamilyId) {
        setActiveFamilyId(nextFamilyId);
        await refreshSetupStatus();
        router.replace('/onboarding');
      }
    }

    setIsAcceptingInvite(false);
  };

  useEffect(() => {
    setDisplayNameInput(familyDisplayName ?? '');
  }, [familyDisplayName]);

  const handleSaveDisplayName = async () => {
    if (!isFamilyReady || !familyId || !user?.id) {
      setDisplayNameError('家族情報の取得中です。少し待ってから再度お試しください');
      return;
    }
    if (!isDisplayNameValid) {
      setDisplayNameError('1〜4文字で入力してください');
      return;
    }

    setDisplayNameError('');
    setDisplayNameMessage('');
    setIsSavingDisplayName(true);

    const { error } = await supabase
      .from('family_members')
      .update({ display_name: displayNameValue })
      .eq('family_id', familyId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Settings] display_name 更新エラー:', error);
      setDisplayNameError('保存に失敗しました');
    } else {
      setDisplayNameMessage('呼称を保存しました');
      await refreshFamilyDisplayName();
    }

    setIsSavingDisplayName(false);
  };

  const handleResetData = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm(
        '初期化しますか？\n\n子ども・記録・写真の情報がすべて削除され、元に戻せません。'
      );
      if (ok) performResetData();
      return;
    }

    Alert.alert(
      '初期化しますか？',
      '子ども・記録・写真の情報がすべて削除され、元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '初期化する', style: 'destructive', onPress: performResetData },
      ]
    );
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('ログアウトしますか？');
      if (!ok) return;
      setIsLoggingOut(true);
      (async () => {
        try {
          await signOut();
        } catch {
          window.alert('エラー: ログアウトに失敗しました');
        } finally {
          setIsLoggingOut(false);
        }
      })();
      return;
    }

    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await signOut();
          } catch {
            Alert.alert('エラー', 'ログアウトに失敗しました');
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader showBack={true} showSettings={false} showChildSwitcher={false} title="設定" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>機能</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/children')}
            activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <View style={styles.iconContainer}>
                <Users size={22} color="#4A90E2" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>子供設定</Text>
                <Text style={styles.menuItemSubtext} numberOfLines={1}>
                  {children.length === 0 ? 'まだ登録されていません' : `登録済み：${children.length}人`}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" style={styles.chevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>

          <View style={styles.accountCard}>
            <Text style={styles.accountLabel}>ログイン中のメールアドレス</Text>
            <Text style={styles.accountEmail}>{user?.email || '未設定'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.7}>
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#E74C3C" />
            ) : (
              <>
                <LogOut size={20} color="#E74C3C" />
                <Text style={styles.logoutButtonText}>ログアウト</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>家族共有</Text>

          {isOwner && isFamilyReady && familyId ? (
            <View style={styles.familyCard}>
              <Text style={styles.familyCardTitle}>家族を招待（オーナーのみ）</Text>
              <TextInput
                style={styles.input}
                placeholder="招待するメールアドレス"
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="email-address"
                value={inviteEmail}
                onChangeText={setInviteEmail}
              />
              {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
              {inviteMessage ? <Text style={styles.successText}>{inviteMessage}</Text> : null}
              <TouchableOpacity
                style={[styles.primaryButton, isCreatingInvite && styles.primaryButtonDisabled]}
                onPress={handleCreateInvite}
                disabled={isCreatingInvite}
                activeOpacity={0.7}>
                {isCreatingInvite ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>招待コードを作成</Text>
                )}
              </TouchableOpacity>

              {inviteToken ? (
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenLabel}>招待コード</Text>
                  <Text style={styles.tokenValue}>{inviteToken}</Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleCopyToken}>
                    <Text style={styles.secondaryButtonText}>コピー</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.inviteListHeader}>
                <Text style={styles.inviteListTitle}>招待中一覧</Text>
                {isLoadingInvites ? <ActivityIndicator size="small" color="#4A90E2" /> : null}
              </View>
              {inviteList.length === 0 ? (
                <Text style={styles.infoText}>招待中のユーザーはいません</Text>
              ) : (
                inviteList.map((invite) => (
                  <View key={invite.token} style={styles.inviteRow}>
                    <Text style={styles.inviteEmail}>{invite.email}</Text>
                    <Text style={styles.inviteMeta}>
                      期限: {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : '未設定'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                {isFamilyReady ? 'オーナーのみ招待を作成できます' : '家族情報を読み込み中です...'}
              </Text>
            </View>
          )}

          <View style={styles.familyCard}>
            <Text style={styles.familyCardTitle}>招待コードで参加</Text>
            <TextInput
              style={styles.input}
              placeholder="招待コードを入力"
              placeholderTextColor="#999"
              autoCapitalize="none"
              value={acceptToken}
              onChangeText={setAcceptToken}
            />
            {acceptError ? <Text style={styles.errorText}>{acceptError}</Text> : null}
            {acceptMessage ? <Text style={styles.successText}>{acceptMessage}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, isAcceptingInvite && styles.primaryButtonDisabled]}
              onPress={handleAcceptInvite}
              disabled={isAcceptingInvite}
              activeOpacity={0.7}>
              {isAcceptingInvite ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>参加する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>あなたの呼称</Text>
          <Text style={styles.sectionDescription}>
            家族の中での呼び方を設定できます（最大4文字）
          </Text>
          <View style={styles.familyCard}>
            <Text style={styles.currentDisplayName}>
              現在の呼称: {familyDisplayName ?? '保護者'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="例：父、母、ママ"
              placeholderTextColor="#999"
              maxLength={4}
              value={displayNameInput}
              onChangeText={(value) => {
                setDisplayNameInput(value);
                if (displayNameError) setDisplayNameError('');
              }}
            />
            <Text style={styles.remainingText}>あと{remainingChars}文字</Text>
            {displayNameError ? <Text style={styles.errorText}>{displayNameError}</Text> : null}
            {displayNameMessage ? <Text style={styles.successText}>{displayNameMessage}</Text> : null}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!isDisplayNameValid || isDisplayNameUnchanged || isSavingDisplayName) &&
                  styles.primaryButtonDisabled,
              ]}
              onPress={handleSaveDisplayName}
              disabled={!isDisplayNameValid || isDisplayNameUnchanged || isSavingDisplayName}
              activeOpacity={0.7}>
              {isSavingDisplayName ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>保存する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリについて</Text>
          <View style={styles.infoCard}>
            <Text style={styles.appName}>テストアルバム</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appDescription}>
              子供のテストや成績を記録して、{'\n'}
              頑張りを見える化するアプリです。
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>法的情報</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/privacy-policy')}
            activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <View style={styles.iconContainer}>
                <Shield size={22} color="#4A90E2" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>プライバシーポリシー</Text>
                <Text style={styles.menuItemSubtext}>個人情報の取り扱いについて</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" style={styles.chevron} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemSpacing]}
            onPress={() => router.push('/terms-of-service')}
            activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <View style={styles.iconContainer}>
                <FileText size={22} color="#4A90E2" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>利用規約</Text>
                <Text style={styles.menuItemSubtext}>アプリの利用条件</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" style={styles.chevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>データ管理</Text>
          <View style={styles.dangerZone}>
            <View style={styles.dangerHeader}>
              <Trash2 size={20} color="#E74C3C" />
              <Text style={styles.dangerTitle}>データを初期化</Text>
            </View>
            <Text style={styles.dangerDescription}>
              子ども・記録・写真がすべて削除されます
            </Text>
            <TouchableOpacity
              style={[styles.dangerButton, isResetting && styles.dangerButtonDisabled]}
              onPress={handleResetData}
              disabled={isResetting}
              activeOpacity={0.7}>
              {isResetting ? (
                <ActivityIndicator size="small" color="#E74C3C" />
              ) : (
                <Text style={styles.dangerButtonText}>初期化する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.7}>
          <Home size={24} color="#999" strokeWidth={2} />
          <Text style={styles.tabLabel}>ホーム</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => router.push('/(tabs)/list')}
          activeOpacity={0.7}>
          <List size={24} color="#999" strokeWidth={2} />
          <Text style={styles.tabLabel}>一覧</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/add')}
          activeOpacity={0.85}>
          <Plus size={32} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => router.push('/(tabs)/monthly')}
          activeOpacity={0.7}>
          <Calendar size={24} color="#999" strokeWidth={2} />
          <Text style={styles.tabLabel}>記録</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
    paddingTop: 108,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginBottom: 8,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  menuItemSpacing: {
    marginTop: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerLocked: {
    backgroundColor: '#f5f5f5',
  },
  menuItemContent: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  menuItemSubtext: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#999',
  },
  chevron: {
    flexShrink: 0,
  },
  lockedItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  menuItemTextLocked: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#999',
  },
  lockedHint: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
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
  familyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  familyCardTitle: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
    marginBottom: 12,
  },
  currentDisplayName: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#999',
  },
  remainingText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#E74C3C',
    marginBottom: 6,
  },
  successText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#27AE60',
    marginBottom: 6,
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
  tokenBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  tokenLabel: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF6FF',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontFamily: 'Nunito-SemiBold',
    color: '#2563EB',
  },
  inviteListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  inviteListTitle: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  inviteRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  inviteEmail: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
  },
  inviteMeta: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginTop: 2,
  },
  appName: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginBottom: 16,
  },
  appDescription: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  dangerZone: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFE5E5',
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
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dangerTitle: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: '#E74C3C',
  },
  dangerDescription: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginBottom: 16,
    lineHeight: 18,
  },
  dangerButton: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E74C3C',
    ...(Platform.OS === 'web' && { cursor: 'pointer' as const }),
  },
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  dangerButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    color: '#E74C3C',
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  accountLabel: {
    fontSize: 12,
    fontFamily: 'Nunito-SemiBold',
    color: '#999',
    marginBottom: 4,
  },
  accountEmail: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFE5E5',
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
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    color: '#E74C3C',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
    ...Platform.select({
      web: {
        boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
    color: '#999',
  },
  addButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(74, 144, 226, 0.3)',
      },
      default: {
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
});
