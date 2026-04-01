import { Tabs, useRouter } from 'expo-router';
import { Home, TrendingUp, Plus, Calendar } from 'lucide-react-native';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DateProvider } from '@/contexts/DateContext';
import { useSafeBottom } from '@/lib/useSafeBottom';
import { TAB_BAR_HEIGHT, TAB_ITEM_PADDING_TOP, TAB_ITEM_PADDING_BOTTOM, TAB_LABEL_FONT_SIZE, TAB_LABEL_MARGIN_TOP, TAB_LABEL_LINE_HEIGHT, ADD_BUTTON_SIZE } from '@/components/TabBar/shared';

export default function TabLayout() {
  const router = useRouter();
  const { safeBottom } = useSafeBottom(16);

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
          <View
            style={[
              styles.tabBarContainer,
              {
                height: TAB_BAR_HEIGHT + TAB_ITEM_PADDING_TOP + TAB_ITEM_PADDING_BOTTOM + safeBottom,
                paddingTop: TAB_ITEM_PADDING_TOP,
                paddingBottom: TAB_ITEM_PADDING_BOTTOM + safeBottom,
              },
            ]}>
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

            {/* グラフ */}
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

            {/* ＋ボタン（記録を追加）アイコン＋ラベル(42px)と円(48px)の高さ差を補正して一直線に */}
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
        name="graph"
        options={{
          title: 'グラフ',
          tabBarIcon: ({ color, focused }) => (
            <TrendingUp size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
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
      <Tabs.Screen
        name="list"
        options={{ href: null }}
      />
      </Tabs>
    </DateProvider>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#FFFFFF',
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
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: TAB_LABEL_FONT_SIZE,
    lineHeight: TAB_LABEL_LINE_HEIGHT,
    fontFamily: 'Nunito-Bold',
    marginTop: TAB_LABEL_MARGIN_TOP,
  },
  addButtonContainer: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    marginTop: 3,
    borderRadius: ADD_BUTTON_SIZE / 2,
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
