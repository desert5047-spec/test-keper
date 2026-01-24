import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Settings, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ChildSwitcher } from './ChildSwitcher';

interface AppHeaderProps {
  showBack?: boolean;
  showSettings?: boolean;
  showChildSwitcher?: boolean;
}

export function AppHeader({
  showBack = false,
  showSettings = true,
  showChildSwitcher = true
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
        ) : showChildSwitcher ? (
          <ChildSwitcher />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <View style={styles.right}>
        {showSettings && (
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
            activeOpacity={0.7}>
            <Settings size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFF',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    alignItems: 'flex-start',
  },
  right: {
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  settingsButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 44,
  },
});
