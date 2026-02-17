import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  confirmWord?: string;
};

export function ResetConfirmModal({
  visible,
  onCancel,
  onConfirm,
  title = '完全リセット（初期化）',
  description = '子ども情報・記録・写真・家族設定がすべて削除されます。\nこの操作は元に戻せません。',
  confirmWord = 'RESET',
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const canConfirm = useMemo(() => {
    return text.trim().toUpperCase() === confirmWord.toUpperCase();
  }, [text, confirmWord]);

  const handleConfirm = async () => {
    if (!canConfirm || busy) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{description}</Text>

          <Text style={styles.label}>
            実行するには <Text style={styles.word}>{confirmWord}</Text> と入力してください
          </Text>

          <TextInput
            value={text}
            onChangeText={setText}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            style={styles.input}
            placeholder={confirmWord}
            placeholderTextColor="#999"
          />

          <View style={styles.row}>
            <Pressable onPress={onCancel} disabled={busy} style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}>
              <Text style={styles.btnGhostText}>キャンセル</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={!canConfirm || busy}
              style={[styles.btn, styles.btnDanger, (!canConfirm || busy) && styles.btnDisabled]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnDangerText}>完全リセットする</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 14, color: '#333', marginBottom: 12, lineHeight: 20 },
  label: { fontSize: 13, color: '#333', marginBottom: 8 },
  word: { fontWeight: '800' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: '#f2f2f2' },
  btnGhostText: { fontWeight: '700' },
  btnDanger: { backgroundColor: '#e5484d' },
  btnDangerText: { color: '#fff', fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
});
