import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { envLabel, supabaseUrl } from '@/lib/supabase';
import { getLpHost } from '@/lib/lpUrl';

function getSupabaseRef(url: string | undefined): string {
  if (!url) return '...';
  try {
    const host = new URL(url).hostname;
    return host.replace(/\.supabase\.co$/, '') || host;
  } catch {
    return '...';
  }
}

export default function DebugLabel() {
  const insets = useSafeAreaInsets();

  if (!__DEV__) return null;

  const ref = getSupabaseRef(supabaseUrl);
  const host = getLpHost();

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 44 }]}>
      <Text style={styles.line1}>{`${envLabel} / ${ref}`}</Text>
      <Text style={styles.line2}>{host}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    zIndex: 9999,
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  line1: {
    fontSize: 10,
    color: '#666',
  },
  line2: {
    fontSize: 9,
    color: '#999',
    marginTop: 0,
  },
});
