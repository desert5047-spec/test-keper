import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Users, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();
  const [recordsCount, setRecordsCount] = useState(0);
  const [isFeatureUnlocked, setIsFeatureUnlocked] = useState(false);

  useEffect(() => {
    loadRecordsCount();
  }, []);

  const loadRecordsCount = async () => {
    const { count } = await supabase
      .from('records')
      .select('*', { count: 'exact', head: true });

    const totalCount = count || 0;
    setRecordsCount(totalCount);
    setIsFeatureUnlocked(totalCount >= 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>機能</Text>

          {isFeatureUnlocked ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/children')}
              activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <View style={styles.iconContainer}>
                  <Users size={22} color="#4A90E2" />
                </View>
                <Text style={styles.menuItemText}>子ども管理</Text>
              </View>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>
          ) : (
            <View style={styles.lockedItem}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, styles.iconContainerLocked]}>
                  <Users size={22} color="#999" />
                </View>
                <View>
                  <Text style={styles.menuItemTextLocked}>子ども管理</Text>
                  <Text style={styles.lockedHint}>1件記録すると使えます</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリについて</Text>
          <View style={styles.infoCard}>
            <Text style={styles.appName}>テストキーパー</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appDescription}>
              子どものテストや成績を記録して、{'\n'}
              頑張りを見える化するアプリです。
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Nunito-Bold',
    color: '#333',
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
  menuItemText: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
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
});
