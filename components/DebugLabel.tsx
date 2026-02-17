import { Text, StyleSheet, View } from 'react-native';
import { envLabel } from '@/lib/supabase';

/**
 * 環境ラベル（stg / prod / dev）を小さく表示する。
 * 本番（prod）では極薄にして目立たないようにする。
 */
export function DebugLabel() {
  const isProd = envLabel === 'prod';
  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Text style={[styles.label, isProd && styles.labelProd]}>{envLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 9999,
  },
  label: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  labelProd: {
    opacity: 0.25,
    color: '#999',
  },
});
