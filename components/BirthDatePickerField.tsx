import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar as CalendarIcon } from 'lucide-react-native';

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromYmd(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function toJapaneseDateLabel(value: string): string {
  const parsed = fromYmd(value);
  if (!parsed) return '';
  const y = parsed.getFullYear();
  const m = parsed.getMonth() + 1;
  const d = parsed.getDate();
  return `${y}年${m}月${d}日`;
}

type BirthDatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  maxDate?: Date;
  placeholder?: string;
};

export function BirthDatePickerField({
  value,
  onChange,
  maxDate = new Date(),
  placeholder = 'タップして選択',
}: BirthDatePickerFieldProps) {
  const [iosVisible, setIosVisible] = useState(false);
  const [iosDate, setIosDate] = useState<Date>(new Date());
  const parsedValue = useMemo(() => fromYmd(value), [value]);
  const displayValue = useMemo(() => toJapaneseDateLabel(value), [value]);

  const openPicker = () => {
    const initial = parsedValue ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        maximumDate: maxDate,
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            onChange(toYmd(selectedDate));
          }
        },
      });
      return;
    }
    setIosDate(initial);
    setIosVisible(true);
  };

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.8}>
        <Text style={[styles.value, !displayValue && styles.placeholder]}>{displayValue || placeholder}</Text>
        <CalendarIcon size={18} color="#4A90E2" />
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <Modal
          visible={iosVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIosVisible(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setIosVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setIosVisible(false)} style={styles.actionBtn}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  onChange(toYmd(iosDate));
                  setIosVisible(false);
                }}
                style={styles.actionBtn}
              >
                <Text style={styles.doneText}>決定</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={iosDate}
              mode="date"
              display="spinner"
              locale="ja-JP"
              maximumDate={maxDate}
              onChange={(_, selectedDate) => {
                if (selectedDate) setIosDate(selectedDate);
              }}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Nunito-Regular',
  },
  placeholder: {
    color: '#999',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingTop: 10,
    paddingBottom: 22,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Nunito-SemiBold',
  },
  doneText: {
    fontSize: 16,
    color: '#4A90E2',
    fontFamily: 'Nunito-Bold',
  },
});

