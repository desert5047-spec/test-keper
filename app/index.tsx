import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    session,
    initializing,
    loading,
    isSetupReady,
    needsDisplayName,
    needsChildSetup,
  } = useAuth();

  useEffect(() => {
    if (pathname !== '/') return;
    if (initializing || loading) return;

    if (!session?.user) {
      router.replace('/(auth)/login');
      return;
    }

    // セットアップ判定が終わるまで待つ（記録・子供の有無など）
    if (!isSetupReady) return;

    // 表示名や子供登録が必要ならオンボーディングへ（同意はWeb新規登録で確認済みのため /consent へは遷移しない）
    if (needsDisplayName || needsChildSetup) {
      router.replace('/onboarding');
      return;
    }

    router.replace('/(tabs)');
  }, [
    pathname,
    initializing,
    loading,
    isSetupReady,
    needsDisplayName,
    needsChildSetup,
    session?.user,
    router,
  ]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
