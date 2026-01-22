import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    const hasCompleted = await AsyncStorage.getItem('hasCompletedOnboarding');

    if (hasCompleted) {
      await ensureDefaultChild();
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  };

  const ensureDefaultChild = async () => {
    const { data: children } = await supabase
      .from('children')
      .select('*')
      .maybeSingle();

    if (!children) {
      await supabase
        .from('children')
        .insert({
          name: null,
          grade: null,
          color: '#FF6B6B',
          is_default: true,
        });
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90E2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
