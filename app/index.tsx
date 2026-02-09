import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, initializing } = useAuth();

  useEffect(() => {
    if (pathname !== '/') return;
    if (initializing) return;
    if (session?.user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [pathname, initializing, session?.user, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
