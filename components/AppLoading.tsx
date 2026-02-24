import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppBrand from './AppBrand';

type AppLoadingProps = {
  message?: string;
};

export default function AppLoading({ message = '読み込み中…' }: AppLoadingProps) {
  return (
    <View style={styles.wrap}>
      <AppBrand subtitle={message} />
      <ActivityIndicator size="large" color="#4A90E2" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
