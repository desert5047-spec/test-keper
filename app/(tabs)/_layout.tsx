import { Tabs } from 'expo-router';
import { Home, List, PlusCircle, Calendar } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: '#eee',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Nunito-Bold',
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ size, color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <Home size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: '一覧',
          tabBarIcon: ({ size, color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <List size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '登録',
          tabBarIcon: ({ size, color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <PlusCircle size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="monthly"
        options={{
          title: '月の記録',
          tabBarIcon: ({ size, color, focused }) => (
            <View style={focused && styles.activeIconContainer}>
              <Calendar size={26} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
