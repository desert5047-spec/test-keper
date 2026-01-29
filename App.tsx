import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';

function AppContent() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {session ? <Text>Home</Text> : <Text>Login</Text>}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
