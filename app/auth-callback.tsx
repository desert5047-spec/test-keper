import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AuthCallbackDeepLink() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>認証コールバック</Text>
        <Text style={styles.text}>
          起動安定化のため、現在は深いリンク処理を停止しています。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111',
  },
  text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
