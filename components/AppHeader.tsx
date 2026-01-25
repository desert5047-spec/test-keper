import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Settings, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChildSwitcher } from './ChildSwitcher';
import { useDateContext } from '@/contexts/DateContext';

export const HEADER_HEIGHT = 108;

interface AppHeaderProps {
  showBack?: boolean;
  showSettings?: boolean;
  showChildSwitcher?: boolean;
  showYearMonthNav?: boolean;
  title?: string;
}

export function AppHeader({
  showBack = false,
  showSettings = true,
  showChildSwitcher = true,
  showYearMonthNav = false,
  title
}: AppHeaderProps) {
  const router = useRouter();
  const { year, month, setYearMonth } = useDateContext();
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const handleMonthChange = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      if (month === 12) {
        setYearMonth(year + 1, 1);
      } else {
        setYearMonth(year, month + 1);
      }
    } else {
      if (month === 1) {
        setYearMonth(year - 1, 12);
      } else {
        setYearMonth(year, month - 1);
      }
    }
  };

  const handleMonthSelect = (selectedMonth: number) => {
    setYearMonth(year, selectedMonth);
    setShowMonthPicker(false);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}>
              <ArrowLeft size={20} color="#333" />
            </TouchableOpacity>
          ) : showChildSwitcher ? (
            <ChildSwitcher />
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

        {showYearMonthNav && (
          <View style={styles.center}>
            <TouchableOpacity
              style={styles.yearArrow}
              onPress={() => handleMonthChange('prev')}
              activeOpacity={0.7}>
              <ChevronLeft size={18} color="#666" />
            </TouchableOpacity>
            <Text style={styles.yearText}>{year}年</Text>
            <TouchableOpacity
              style={styles.yearArrow}
              onPress={() => handleMonthChange('next')}
              activeOpacity={0.7}>
              <ChevronRight size={18} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => setShowMonthPicker(true)}
              activeOpacity={0.7}>
              <Text style={styles.monthText}>{month}月</Text>
              <ChevronDown size={14} color="#666" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
          </View>
        )}

        <View style={styles.right}>
          {showSettings && (
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={styles.settingsButton}
              activeOpacity={0.7}>
              <Settings size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}>
          <View style={styles.monthPickerContainer}>
            <Text style={styles.monthPickerTitle}>月を選択</Text>
            <ScrollView style={styles.monthPickerScroll}>
              <View style={styles.monthPickerGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.monthPickerItem,
                      month === m && styles.monthPickerItemSelected,
                    ]}
                    onPress={() => handleMonthSelect(m)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.monthPickerItemText,
                        month === m && styles.monthPickerItemTextSelected,
                      ]}>
                      {m}月
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    paddingTop: 50,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: HEADER_HEIGHT,
    zIndex: 10,
  },
  left: {
    alignItems: 'flex-start',
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  right: {
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 36,
  },
  yearArrow: {
    padding: 2,
  },
  yearText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
    marginLeft: 4,
  },
  monthText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '80%',
    maxWidth: 360,
    maxHeight: '70%',
  },
  monthPickerTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    textAlign: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  monthPickerScroll: {
    maxHeight: 400,
  },
  monthPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  monthPickerItem: {
    width: '30%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  monthPickerItemSelected: {
    backgroundColor: '#4A90E2',
  },
  monthPickerItemText: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#666',
  },
  monthPickerItemTextSelected: {
    color: '#fff',
  },
});
