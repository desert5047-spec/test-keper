import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

interface CalendarPickerProps {
  visible: boolean;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onClose: () => void;
  maxDate?: Date;
}

export function CalendarPicker({
  visible,
  selectedDate,
  onDateSelect,
  onClose,
  maxDate = new Date(),
}: CalendarPickerProps) {
  const parseDate = (dateString: string): Date => {
    try {
      return new Date(dateString);
    } catch {
      return new Date();
    }
  };

  const [currentMonth, setCurrentMonth] = useState(
    parseDate(selectedDate)
  );

  const getMonthData = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    return {
      year,
      month,
      daysInMonth,
      startDayOfWeek,
    };
  };

  const monthData = getMonthData(currentMonth);
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  for (let i = 0; i < monthData.startDayOfWeek; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= monthData.daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(
      new Date(monthData.year, monthData.month - 1, 1)
    );
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(monthData.year, monthData.month + 1, 1);
    if (nextMonth <= maxDate) {
      setCurrentMonth(nextMonth);
    }
  };

  const handleDayPress = (day: number) => {
    const newDate = new Date(monthData.year, monthData.month, day);
    if (newDate <= maxDate) {
      const formattedDate = `${monthData.year}-${String(monthData.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      onDateSelect(formattedDate);
      onClose();
    }
  };

  const isSelectedDay = (day: number): boolean => {
    try {
      const selected = parseDate(selectedDate);
      return (
        selected.getFullYear() === monthData.year &&
        selected.getMonth() === monthData.month &&
        selected.getDate() === day
      );
    } catch {
      return false;
    }
  };

  const isDisabledDay = (day: number): boolean => {
    const date = new Date(monthData.year, monthData.month, day);
    return date > maxDate;
  };

  const isNextMonthDisabled = (): boolean => {
    const nextMonth = new Date(monthData.year, monthData.month + 1, 1);
    return nextMonth > maxDate;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <View style={styles.calendarContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}>
            <X size={24} color="#666" />
          </TouchableOpacity>

          <View style={styles.header}>
            <TouchableOpacity
              onPress={handlePreviousMonth}
              style={styles.navButton}
              activeOpacity={0.7}>
              <ChevronLeft size={24} color="#4A90E2" />
            </TouchableOpacity>
            <Text style={styles.monthYear}>
              {monthData.year}年 {monthData.month + 1}月
            </Text>
            <TouchableOpacity
              onPress={handleNextMonth}
              style={[
                styles.navButton,
                isNextMonthDisabled() && styles.navButtonDisabled,
              ]}
              disabled={isNextMonthDisabled()}
              activeOpacity={0.7}>
              <ChevronRight
                size={24}
                color={isNextMonthDisabled() ? '#CCC' : '#4A90E2'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.weekDaysRow}>
            {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
              <View key={index} style={styles.weekDayCell}>
                <Text
                  style={[
                    styles.weekDayText,
                    index === 0 && styles.sundayText,
                    index === 6 && styles.saturdayText,
                  ]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                const selected = day !== null && isSelectedDay(day);
                const disabled = day !== null && isDisabledDay(day);
                const isSunday = dayIndex === 0;
                const isSaturday = dayIndex === 6;

                return (
                  <View key={dayIndex} style={styles.dayCell}>
                    {day !== null ? (
                      <TouchableOpacity
                        style={[
                          styles.dayButton,
                          selected && styles.dayButtonSelected,
                          disabled && styles.dayButtonDisabled,
                        ]}
                        onPress={() => handleDayPress(day)}
                        disabled={disabled}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.dayText,
                            selected && styles.dayTextSelected,
                            disabled && styles.dayTextDisabled,
                            !selected && !disabled && isSunday && styles.sundayText,
                            !selected && !disabled && isSaturday && styles.saturdayText,
                          ]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.dayButton} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            style={styles.closeButtonBottom}
            onPress={onClose}
            activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  monthYear: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  sundayText: {
    color: '#E74C3C',
  },
  saturdayText: {
    color: '#4A90E2',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    padding: 2,
  },
  dayButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayButtonSelected: {
    backgroundColor: '#4A90E2',
  },
  dayButtonDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
    color: '#333',
  },
  dayTextSelected: {
    color: '#fff',
    fontFamily: 'Nunito-Bold',
  },
  dayTextDisabled: {
    color: '#CCC',
  },
  closeButtonBottom: {
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
});
