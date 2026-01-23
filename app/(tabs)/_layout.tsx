import { Tabs, useRouter } from 'expo-router';
import { Home, List, Plus, Calendar } from 'lucide-react-native';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#eee',
          backgroundColor: '#fff',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Nunito-Bold',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: '一覧',
          tabBarIcon: ({ color, focused }) => (
            <List size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '登録',
          tabBarButton: (props) => (
            <TouchableOpacity
              onPress={() => router.push('/add')}
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={0.7}>
              <View style={styles.addButtonContainer}>
                <Plus size={24} color="#fff" strokeWidth={3} />
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="monthly"
        options={{
          title: '記録',
          tabBarIcon: ({ color, focused }) => (
            <Calendar size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addButtonContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -4,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
