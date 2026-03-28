import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Users, ChevronRight, Home, List, Plus, Calendar, Trash2, LogOut, FileText, Shield, MessageCircle, UserPlus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { AppHeader, useHeaderTop } from '@/components/AppHeader';
import { ResetConfirmModal } from '@/components/ResetConfirmModal';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { deleteImage } from '@/utils/imageUpload';
import { warn, error as logError } from '@/lib/logger';
import { webUrls } from '@/lib/urls';
import { useSafeBottom } from '@/lib/useSafeBottom';
import { TAB_BAR_HEIGHT, TAB_ITEM_PADDING_TOP, TAB_ITEM_PADDING_BOTTOM, BOTTOM_NAV_BASE_HEIGHT, TAB_LABEL_FONT_SIZE, TAB_LABEL_MARGIN_TOP, TAB_LABEL_LINE_HEIGHT, ADD_BUTTON_SIZE } from '@/components/TabBar/shared';

export default function SettingsScreen() {
  const router = useRouter();
  const headerTop = useHeaderTop(true);
  const { safeBottom } = useSafeBottom(16);

  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();

  const { children, loadChildren } = useChild();
  const {
    signOut,
    user,
    familyId,
    isFamilyReady,
    familyDisplayName,
    refreshFamilyDisplayName,
    refreshSetupStatus,
  } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [familyRole, setFamilyRole] = useState<'owner' | 'member' | null>(null);

  const isOwner = familyRole === 'owner';

  const performResetData = async (opts?: { silent?: boolean }) => {
    setIsResetting(true);
    try {
      if (!user?.id) {
        throw new Error('ユーザー情報が見つかりません');
      }
      if (!isFamilyReady || !familyId) {
        throw new Error('家族情報の取得中です。少し待ってから再度お試しください');
      }

      // 家族に紐づく子供一覧を取得
      const { data: childrenList, error: childrenListErr } = await supabase
        .from('children')
        .select('id')
        .eq('family_id', familyId);
      if (childrenListErr) {
        logError('[初期化] children SELECT', childrenListErr);
        throw childrenListErr;
      }

      for (const child of childrenList ?? []) {
        // (1) child_id = child.id の records を SELECT（id, photo_uri）
        const { data: records, error: recordsSelectErr } = await supabase
          .from('records')
          .select('id, photo_uri')
          .eq('child_id', child.id);
        if (recordsSelectErr) {
          logError('[初期化] records SELECT', recordsSelectErr);
          throw recordsSelectErr;
        }

        if (records && records.length > 0) {
          const recordIds = records.map((r) => r.id);

          // (2) record_tags を record_id IN (...) で DELETE
          const { error: tagsErr } = await supabase
            .from('record_tags')
            .delete()
            .in('record_id', recordIds);
          if (tagsErr) {
            logError('[初期化] record_tags DELETE', tagsErr);
            throw tagsErr;
          }

          // (3) 各 record の photo_uri がある場合、Storage 削除
          for (const r of records) {
            if (r.photo_uri) await deleteImage(r.photo_uri);
          }

          // (4) records を child_id = child.id で DELETE
          const { error: recordsDeleteErr } = await supabase
            .from('records')
            .delete()
            .eq('child_id', child.id);
          if (recordsDeleteErr) {
            logError('[初期化] records DELETE', recordsDeleteErr);
            throw recordsDeleteErr;
          }
        }
      }

      const { error: subjectsErr } = await supabase
        .from('subjects')
        .delete()
        .eq('family_id', familyId);
      if (subjectsErr) {
        logError('[初期化] subjects DELETE', subjectsErr);
        throw subjectsErr;
      }

      const { error: childrenError } = await supabase
        .from('children')
        .delete()
        .eq('family_id', familyId);
      if (childrenError) {
        logError('[初期化] children DELETE', childrenError);
        throw new Error('初期化に失敗しました');
      }

      const { error: displayNameResetError } = await supabase
        .from('family_members')
        .update({ display_name: null })
        .eq('family_id', familyId)
        .eq('user_id', user.id);

      if (displayNameResetError) {
        throw new Error('ユーザーネームの初期化に失敗しました');
      }

      await AsyncStorage.removeItem('hasCompletedOnboarding');
      await loadChildren();
      await refreshFamilyDisplayName();
      await refreshSetupStatus();

      if (opts?.silent) {
        return;
      }
      if (Platform.OS === 'web') {
        window.alert('すべてのデータを削除しました');
        await signOut();
      } else {
        Alert.alert('初期化完了', 'すべてのデータを削除しました', [
          { text: 'OK', onPress: () => void signOut() },
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
      logError('[Settings] family role 取得エラー');
      setFamilyRole(null);
      return;
    }

    setFamilyRole((data?.role as 'owner' | 'member') ?? null);
  }, [user?.id, isFamilyReady, familyId]);

  useEffect(() => {
    loadFamilyRole();
  }, [loadFamilyRole]);

  const handleResetData = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm(
        '初期化しますか？\n\n子ども・記録・写真の情報がすべて削除され、元に戻せません。'
      );
      if (ok) setResetModalVisible(true);
      return;
    }

    Alert.alert(
      '完全リセットしますか？',
      '子ども・記録・写真の情報がすべて削除され、元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '続ける', style: 'destructive', onPress: () => setResetModalVisible(true) },
      ]
    );
  };

  const runFullReset = async () => {
    await performResetData({ silent: true });
    setResetModalVisible(false);
    await signOut();
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

  const openPrivacyPolicy = () => {
    const url = webUrls.privacy;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch((error) => {
      warn('[Settings] プライバシーポリシーを開けませんでした');
    });
  };

  const openTerms = () => {
    const url = webUrls.terms;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch((error) => {
      warn('[Settings] 利用規約を開けませんでした');
    });
  };

  const openContact = () => {
    const url = 'https://docs.google.com/forms/d/e/1FAIpQLSeNQjw8CRwEPbCD9JfvAY3dbWTdDNlyXBV8UOk4zdtGQLTOTg/viewform';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch((error) => {
      warn('[Settings] お問い合わせを開けませんでした');
    });
  };

  const openDeleteAccount = async () => {
    const url = webUrls.deleteAccount;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert('開けませんでした', 'ブラウザでURLを開けませんでした。');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('エラー', 'ページを開けませんでした。');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={styles.container}>
      <AppHeader showBack={true} showSettings={false} showChildSwitcher={false} title="設定" safeTopByParent={true} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerTop + 4,
            paddingBottom: BOTTOM_NAV_BASE_HEIGHT + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.section, styles.sectionFirst]}>
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
                <Text style={styles.menuItemText}>子ども設定</Text>
                <Text style={styles.menuItemSubtext}>子どもの追加や変更ができます</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" style={styles.chevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>家族</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/settings/family')}
            activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <View style={styles.iconContainer}>
                <Users size={22} color="#4A90E2" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>家族メンバー</Text>
                <Text style={styles.menuItemSubtext}>家族の一覧と役割を確認できます</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" style={styles.chevron} />
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemSpacing]}
              onPress={() => router.push('/settings/invite')}
              activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <View style={styles.iconContainer}>
                  <UserPlus size={22} color="#4A90E2" />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemText}>家族を招待</Text>
                  <Text style={styles.menuItemSubtext}>招待リンクを作成して共有できます</Text>
                </View>
              </View>
              <ChevronRight size={20} color="#999" style={styles.chevron} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>

          <View style={styles.accountCard}>
            <Text style={styles.accountLabel}>ログイン中のメールアドレス</Text>
            <Text style={styles.accountEmail}>{user?.email || '未設定'}</Text>
          </View>

          <View style={[styles.accountCard, { marginTop: 8 }]}>
            <Text style={styles.accountLabel}>親の名前</Text>
            <Text style={styles.accountEmail}>{familyDisplayName ?? '保護者'}</Text>
            <Text style={styles.disabledHint}>現在、親の名前は変更できません</Text>
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
          <Text style={styles.sectionTitle}>法的情報</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={openPrivacyPolicy}
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
            onPress={openTerms}
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

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemSpacing]}
            onPress={openContact}
            activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <View style={styles.iconContainer}>
                <MessageCircle size={22} color="#4A90E2" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>お問い合わせ</Text>
                <Text style={styles.menuItemSubtext}>ご質問・ご要望はこちら</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" style={styles.chevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>データ管理</Text>
          <View style={styles.dangerZone}>
            <View style={styles.dangerHeader}>
              <Trash2 size={20} color="#333" />
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          <View style={styles.deleteAccountCard}>
            <Text style={styles.deleteAccountTitle}>アカウント削除（退会）</Text>
            <Text style={styles.deleteAccountDescription}>
              アカウント削除をご希望の場合は、削除依頼フォームからお手続きください。
            </Text>
            <Pressable onPress={openDeleteAccount} style={styles.deleteAccountButton}>
              <Text style={styles.deleteAccountButtonText}>削除依頼フォームを開く</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリについて</Text>
          <View style={styles.infoCard}>
            <Text style={styles.appName}>テストアルバム</Text>
            <Text style={styles.appVersion}>{`Version ${appVersion} (${buildNumber ?? '-'})`}</Text>
            <Text style={styles.appDescription}>
              子供のテストや成績を記録して、{'\n'}
              頑張りを見える化するアプリです。
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomNav,
          {
            height: TAB_BAR_HEIGHT + TAB_ITEM_PADDING_TOP + TAB_ITEM_PADDING_BOTTOM + safeBottom,
            paddingTop: TAB_ITEM_PADDING_TOP,
            paddingBottom: TAB_ITEM_PADDING_BOTTOM + safeBottom,
          },
        ]}>
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
          style={styles.tabButton}
          onPress={() => router.push('/add')}
          activeOpacity={0.85}>
          <View style={styles.addButton}>
            <Plus size={28} color="#fff" strokeWidth={3} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => router.push('/(tabs)/monthly')}
          activeOpacity={0.7}>
          <Calendar size={24} color="#999" strokeWidth={2} />
          <Text style={styles.tabLabel}>記録</Text>
        </TouchableOpacity>
      </View>

      <ResetConfirmModal
        visible={resetModalVisible}
        onCancel={() => setResetModalVisible(false)}
        onConfirm={runFullReset}
        confirmWord="RESET"
      />
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
    paddingBottom: 24,
  },
  section: {
    marginTop: 12,
    paddingHorizontal: 20,
  },
  sectionFirst: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
    fontWeight: '700',
    color: '#333',
  },
  dangerDescription: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  dangerButton: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    ...(Platform.OS === 'web' && { cursor: 'pointer' as const }),
  },
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  dangerButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#333',
  },
  deleteAccountCard: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
  deleteAccountTitle: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#333',
  },
  deleteAccountDescription: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#666',
    lineHeight: 20,
  },
  deleteAccountButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' as const }),
  },
  deleteAccountButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#333',
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
  disabledHint: {
    fontSize: 11,
    fontFamily: 'Nunito-Regular',
    color: '#999',
    marginTop: 4,
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
    paddingHorizontal: 8,
    alignItems: 'center',
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
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: TAB_LABEL_FONT_SIZE,
    lineHeight: TAB_LABEL_LINE_HEIGHT,
    fontFamily: 'Nunito-Bold',
    marginTop: TAB_LABEL_MARGIN_TOP,
    color: '#999',
  },
  addButton: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_SIZE / 2,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
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
