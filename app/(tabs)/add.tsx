import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function AddTabScreen() {
  const router = useRouter();

  useEffect(() => {
    router.push('/add');
  }, []);

  return <View />;
}
