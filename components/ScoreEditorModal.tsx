import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';

export type ScoreEditorModalProps = {
  visible: boolean;
  initialValue: number | null;
  fullScore: number;
  onClose: () => void;
  onConfirm: (value: number | null) => void;
};

const PAD_ROWS: (number | null)[][] = [
  [7, 8, 9],
  [4, 5, 6],
  [1, 2, 3],
  [null, 0, null],
];

export function ScoreEditorModal({
  visible,
  initialValue,
  fullScore,
  onClose,
  onConfirm,
}: ScoreEditorModalProps) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) {
      setDraft(initialValue != null ? String(initialValue) : '');
    }
  }, [visible, initialValue]);

  const maxLen = Math.max(1, String(fullScore).length);
  const parsed = draft === '' ? null : parseInt(draft, 10);
  const isValid = parsed === null || (Number.isFinite(parsed) && parsed >= 0 && parsed <= fullScore);
  const overFull = parsed !== null && Number.isFinite(parsed) && parsed > fullScore;
  const canConfirm = draft === '' ? true : isValid;

  const append = (digit: number) => {
    if (draft.length >= maxLen) return;
    setDraft((prev) => prev + String(digit));
  };

  const backspace = () => {
    setDraft((prev) => (prev.length <= 1 ? '' : prev.slice(0, -1)));
  };

  const clear = () => setDraft('');

  const handleConfirm = () => {
    if (!canConfirm) return;
    const value =
      draft === '' ? null : Number.isFinite(parsed) ? (parsed as number) : null;
    onConfirm(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>点数を入力</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.displayRow}>
            <Text style={styles.displayValue} numberOfLines={1}>
              {draft || '—'}
            </Text>
            <Text style={styles.displayUnit} numberOfLines={1}>
              {' 点 / '}{fullScore}{' 点中'}
            </Text>
          </View>

          {overFull && (
            <Text style={styles.errorText}>満点（{fullScore}）を超えています</Text>
          )}

          <View style={styles.pad}>
            {PAD_ROWS.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.padRow}>
                {row.map((d, colIdx) =>
                  d === null ? (
                    <View key={`${rowIdx}-${colIdx}`} style={styles.digitBtn} />
                  ) : (
                    <TouchableOpacity
                      key={`${rowIdx}-${colIdx}`}
                      style={styles.digitBtn}
                      onPress={() => append(d)}
                      activeOpacity={0.7}>
                      <Text style={styles.digitText}>{d}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            ))}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={backspace} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>⌫ 1文字削除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={clear} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>クリア</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.7}>
            <Text style={styles.confirmBtnText}>確定</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 8,
    flexWrap: 'nowrap',
  },
  displayValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1a1a1a',
    minWidth: 48,
  },
  displayUnit: {
    fontSize: 20,
    color: '#666',
    marginLeft: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 8,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  padRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    justifyContent: 'center',
  },
  digitBtn: {
    width: 72,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 15,
    color: '#555',
  },
  confirmBtn: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
