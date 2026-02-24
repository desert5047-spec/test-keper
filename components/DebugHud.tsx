import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDebugLogs, getDebugStatus, subscribeDebugLogs } from '@/lib/debugLog';

const isEnabled = process.env.EXPO_PUBLIC_DEBUG_HUD === 'true';

export default function DebugHud() {
  const [logs, setLogs] = useState(getDebugLogs());
  const [status, setStatus] = useState(getDebugStatus());

  useEffect(() => {
    if (!isEnabled) return;
    const unsubscribe = subscribeDebugLogs(() => {
      setLogs(getDebugLogs());
      setStatus(getDebugStatus());
    });
    return unsubscribe;
  }, []);

  if (!isEnabled) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>lastAuthEvent</Text>
        <Text style={styles.value}>{status.lastAuthEvent || '(none)'}</Text>
        <Text style={styles.label}>initializing</Text>
        <Text style={styles.value}>{String(status.initializing)}</Text>
        <Text style={styles.label}>watchdogFired</Text>
        <Text style={styles.value}>{String(status.watchdogFired)}</Text>
        <Text style={styles.label}>loginPressed</Text>
        <Text style={styles.value}>{status.lastLoginPressedAt || '(none)'}</Text>
        <Text style={styles.label}>login</Text>
        <Text style={styles.value}>{status.lastLoginResult || '(none)'}</Text>
      </View>
      <ScrollView style={styles.logBox}>
        {logs.map((log) => (
          <Text key={log.id} style={styles.logText}>
            {log.message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 9999,
    width: 220,
    maxHeight: 260,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 6,
  },
  section: {
    marginBottom: 6,
  },
  label: {
    color: '#ccc',
    fontSize: 10,
  },
  value: {
    color: '#fff',
    fontSize: 10,
    marginBottom: 4,
  },
  logBox: {
    maxHeight: 120,
  },
  logText: {
    color: '#fff',
    fontSize: 10,
    marginBottom: 2,
  },
});
