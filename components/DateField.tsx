import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { CalendarPicker } from '@/components/CalendarPicker';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export function isValidYmd(value: string): boolean {
  return YMD_REGEX.test(value);
}

interface DateFieldProps {
  value?: string;
  onChange: (date: string) => void;
  maxDate?: Date;
  placeholder?: string;
}

export function DateField({
  value,
  onChange,
  maxDate = new Date(),
  placeholder = 'タップして選択',
}: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const displayValue = value && isValidYmd(value) ? value : '';
  const selectedDateForPicker = displayValue || toYmd(new Date());

  const handleDateSelect = (date: string) => {
    if (isValidYmd(date)) {
      onChange(date);
    }
    setShowPicker(false);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={displayValue ? `日付 ${displayValue}` : placeholder}
      >
        <View style={styles.content}>
          <Text
            style={[styles.text, !displayValue && styles.placeholderText]}
            numberOfLines={1}
          >
            {displayValue || placeholder}
          </Text>
          <CalendarIcon size={20} color="#4A90E2" style={styles.icon} />
        </View>
      </Pressable>

      <CalendarPicker
        visible={showPicker}
        selectedDate={selectedDateForPicker}
        onDateSelect={handleDateSelect}
        onClose={() => setShowPicker(false)}
        maxDate={maxDate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  fieldPressed: {
    opacity: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  icon: {
    flexShrink: 0,
  },
});
