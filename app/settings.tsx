import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Users, ChevronRight, Home, List, Plus, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { useChild } from '@/contexts/ChildContext';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { children } = useChild();

  return (
    <View style={styles.container}>
      <AppHeader showBack={true} showSettings={false} showChildSwitcher={false} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                <Text style={styles.menuItemSubtext}>
                  {children.length === 0 ? 'まだ登録されていません' : `登録済み：${children.length}人`}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリについて</Text>
          <View style={styles.infoCard}>
            <Text style={styles.appName}>テストキーパー</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appDescription}>
              子供のテストや成績を記録して、{'\n'}
              頑張りを見える化するアプリです。
            </Text>
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
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
