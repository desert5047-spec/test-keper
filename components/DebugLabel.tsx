import { Text, StyleSheet, View } from 'react-native';
import { envLabel, supabaseUrl } from '@/lib/supabase';
import { getLpHost } from '@/lib/lpUrl';

/** Supabase URL の hostname から project ref を取得（例: cwwzaknsitnaqqafbrsc） */
function getSupabaseRef(url: string | undefined): string {
  if (!url) return '—';
  try {
    const host = new URL(url).hostname;
    return host.replace(/\.supabase\.co$/, '') || host;
  } catch {
    return '—';
  }
}

/**
 * 環境ラベル（stg / prod / dev）、Supabase project ref、LP host を表示する。
 * 表示と実接続の不一致を防ぐ（例: prod / cwwzaknsitnaqqafbrsc / www.test-album.jp）。
 * 本番（prod）では極薄にして目立たないようにする。
 */
export function DebugLabel() {
  const isProd = envLabel === 'prod';
  const ref = getSupabaseRef(supabaseUrl);
  const lpHost = getLpHost();
  const mainText = `${envLabel} / ${ref}`;
  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Text style={[styles.label, isProd && styles.labelProd]}>{mainText}</Text>
      <Text style={[styles.lpHost, isProd && styles.labelProd]}>{lpHost}</Text>
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
  lpHost: {
    fontSize: 8,
    color: '#999',
    marginTop: 2,
  },
  labelProd: {
    opacity: 0.25,
    color: '#999',
  },
});
