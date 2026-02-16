import { Tabs, useRouter } from 'expo-router';
import { Home, List, Plus, Calendar } from 'lucide-react-native';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateProvider } from '@/contexts/DateContext';

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <DateProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#333',
          tabBarInactiveTintColor: '#999',
          unmountOnBlur: false,
        }}
      tabBar={(props) => {
        const { state, descriptors, navigation } = props;

        return (
          <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {/* ホーム */}
            {state.routes.slice(0, 1).map((route, idx) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === idx;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  onPress={onPress}
                  style={styles.tabButton}
                  activeOpacity={0.7}>
                  {options.tabBarIcon?.({
                    focused: isFocused,
                    color: isFocused ? '#333' : '#999',
                    size: 24,
                  })}
                  <Text style={[
                    styles.tabLabel,
                    { color: isFocused ? '#333' : '#999' }
                  ]}>
                    {options.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* 一覧 */}
            {state.routes.slice(1, 2).map((route, idx) => {
              const actualIndex = 1;
              const { options } = descriptors[route.key];
              const isFocused = state.index === actualIndex;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  onPress={onPress}
                  style={styles.tabButton}
                  activeOpacity={0.7}>
                  {options.tabBarIcon?.({
                    focused: isFocused,
                    color: isFocused ? '#333' : '#999',
                    size: 24,
                  })}
                  <Text style={[
                    styles.tabLabel,
                    { color: isFocused ? '#333' : '#999' }
                  ]}>
                    {options.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* ＋ボタン（記録を追加） */}
            <TouchableOpacity
              onPress={() => router.push('/add')}
              style={styles.tabButton}
              activeOpacity={0.7}>
              <View style={styles.addButtonContainer}>
                <Plus size={28} color="#fff" strokeWidth={3} />
              </View>
            </TouchableOpacity>

            {/* 記録 */}
            {state.routes.slice(2, 3).map((route, idx) => {
              const actualIndex = 2;
              const { options } = descriptors[route.key];
              const isFocused = state.index === actualIndex;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  onPress={onPress}
                  style={styles.tabButton}
                  activeOpacity={0.7}>
                  {options.tabBarIcon?.({
                    focused: isFocused,
                    color: isFocused ? '#333' : '#999',
                    size: 24,
                  })}
                  <Text style={[
                    styles.tabLabel,
                    { color: isFocused ? '#333' : '#999' }
                  ]}>
                    {options.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, focused }) => (
            <Home size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: '一覧',
          tabBarIcon: ({ color, focused }) => (
            <List size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="monthly"
        options={{
          title: '記録',
          tabBarIcon: ({ color, focused }) => (
            <Calendar size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      </Tabs>
    </DateProvider>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    ...Platform.select({
      web: {
        boxShadow: '0px -1px 3px rgba(0, 0, 0, 0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Nunito-Bold',
    marginTop: 4,
  },
  addButtonContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(74, 144, 226, 0.3)',
      },
      default: {
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
      },
    }),
  },
});
