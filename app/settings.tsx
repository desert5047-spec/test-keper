import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useState } from 'react';
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
  const { signOut, user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const performResetData = async () => {
    setIsResetting(true);
    try {
      if (!user?.id) {
        throw new Error('ユーザー情報が見つかりません');
      }

      const { data: records } = await supabase
        .from('records')
        .select('photo_uri')
        .eq('user_id', user.id)
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
        .eq('user_id', user.id);

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
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
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
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
