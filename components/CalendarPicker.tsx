import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

const WINDOW_MAX_HEIGHT = Dimensions.get('window').height * 0.85;

const CONTAINER_PADDING = 20;
const HEADER_ROW_HEIGHT = 44;
const HEADER_MARGIN_BOTTOM = 12;
const WEEKDAYS_ROW_HEIGHT = 32;
const WEEKDAYS_MARGIN_BOTTOM = 8;
const DAY_ROW_HEIGHT = 44;
const WEEK_ROW_GAP = 4;
const FOOTER_MARGIN_TOP = 16;
const FOOTER_HEIGHT = 48;

function getWeekCount(year: number, monthIndex: number): number {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sun..6=Sat
  return Math.ceil((startDayOfWeek + daysInMonth) / 7);
}

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
  maxDate,
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
  const weekCount = getWeekCount(monthData.year, monthData.month);
  const calendarHeight =
    CONTAINER_PADDING * 2 +
    HEADER_ROW_HEIGHT +
    HEADER_MARGIN_BOTTOM +
    WEEKDAYS_ROW_HEIGHT +
    WEEKDAYS_MARGIN_BOTTOM +
    weekCount * DAY_ROW_HEIGHT +
    Math.max(0, weekCount - 1) * WEEK_ROW_GAP +
    FOOTER_MARGIN_TOP +
    FOOTER_HEIGHT;
  const containerHeight = Math.min(calendarHeight, WINDOW_MAX_HEIGHT);
  const weeksAreaHeight =
    weekCount * DAY_ROW_HEIGHT + Math.max(0, weekCount - 1) * WEEK_ROW_GAP;
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
    if (!maxDate || nextMonth <= maxDate) {
      setCurrentMonth(nextMonth);
    }
  };

  const handleDayPress = (day: number) => {
    const newDate = new Date(monthData.year, monthData.month, day);
    if (!maxDate || newDate <= maxDate) {
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
    if (!maxDate) return false;
    const date = new Date(monthData.year, monthData.month, day);
    return date > maxDate;
  };

  const isNextMonthDisabled = (): boolean => {
    if (!maxDate) return false;
    const nextMonth = new Date(monthData.year, monthData.month + 1, 1);
    return nextMonth > maxDate;
  };

  const isTodayDay = (day: number): boolean => {
    const today = new Date();
    return (
      today.getFullYear() === monthData.year &&
      today.getMonth() === monthData.month &&
      today.getDate() === day
    );
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
        <View style={[styles.calendarContainer, { height: containerHeight }]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handlePreviousMonth}
              style={styles.navButton}
              activeOpacity={0.7}>
              <ChevronLeft size={24} color="#4A90E2" />
            </TouchableOpacity>
            <Text style={styles.monthYear} numberOfLines={1}>
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
            <TouchableOpacity
              style={styles.closeButtonInHeader}
              onPress={onClose}
              activeOpacity={0.7}>
              <X size={24} color="#666" />
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

          <ScrollView
            style={styles.weeksScroll}
            contentContainerStyle={{ minHeight: weeksAreaHeight }}
            showsVerticalScrollIndicator={false}>
            {weeks.map((week, weekIndex) => (
              <View
                key={weekIndex}
                style={[styles.weekRow, weekIndex < weeks.length - 1 && styles.weekRowGap]}>
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
                          isTodayDay(day) && !selected && styles.dayButtonToday,
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
          </ScrollView>

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
    padding: CONTAINER_PADDING,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: HEADER_ROW_HEIGHT,
    marginBottom: HEADER_MARGIN_BOTTOM,
    paddingTop: 8,
    gap: 4,
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  monthYear: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    textAlign: 'center',
  },
  closeButtonInHeader: {
    padding: 8,
  },
  weekDaysRow: {
    flexDirection: 'row',
    height: WEEKDAYS_ROW_HEIGHT,
    marginBottom: WEEKDAYS_MARGIN_BOTTOM,
  },
  weeksScroll: {
    flex: 1,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    height: DAY_ROW_HEIGHT,
  },
  weekRowGap: {
    marginBottom: WEEK_ROW_GAP,
  },
  dayCell: {
    flex: 1,
    padding: 2,
  },
  dayButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayButtonToday: {
    borderWidth: 1.5,
    borderColor: '#4A90E2',
    backgroundColor: '#EEF5FF',
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
    height: FOOTER_HEIGHT,
    marginTop: FOOTER_MARGIN_TOP,
    paddingVertical: 14,
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
});
