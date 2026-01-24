import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Settings, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChildSwitcher } from './ChildSwitcher';
import { useDateContext } from '@/contexts/DateContext';

interface AppHeaderProps {
  showBack?: boolean;
  showSettings?: boolean;
  showChildSwitcher?: boolean;
  showYearMonthNav?: boolean;
}

export function AppHeader({
  showBack = false,
  showSettings = true,
  showChildSwitcher = true,
  showYearMonthNav = false
}: AppHeaderProps) {
  const router = useRouter();
  const { year, month, setYearMonth } = useDateContext();
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const handleYearChange = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      const newYear = year + 1;
      setYearMonth(newYear, 1);
    } else {
      const newYear = year - 1;
      setYearMonth(newYear, 12);
    }
  };

  const handleMonthSelect = (selectedMonth: number) => {
    setYearMonth(year, selectedMonth);
    setShowMonthPicker(false);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.left}>
            {showBack ? (
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                activeOpacity={0.7}>
                <ArrowLeft size={24} color="#333" />
              </TouchableOpacity>
            ) : showChildSwitcher ? (
              <ChildSwitcher />
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>

          <View style={styles.right}>
            {showSettings && (
              <TouchableOpacity
                onPress={() => router.push('/settings')}
                style={styles.settingsButton}
                activeOpacity={0.7}>
                <Settings size={24} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showYearMonthNav && (
          <View style={styles.yearMonthRow}>
            <TouchableOpacity
              style={styles.yearArrow}
              onPress={() => handleYearChange('next')}
              activeOpacity={0.7}>
              <ChevronLeft size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.yearText}>{year}年</Text>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => setShowMonthPicker(true)}
              activeOpacity={0.7}>
              <Text style={styles.monthText}>{month}月</Text>
              <ChevronDown size={20} color="#666" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.yearArrow}
              onPress={() => handleYearChange('prev')}
              activeOpacity={0.7}>
              <ChevronRight size={24} color="#666" />
            </TouchableOpacity>
          </View>
        )}
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
    backgroundColor: '#FFF',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  left: {
    flex: 1,
    alignItems: 'flex-start',
  },
  right: {
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  settingsButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 44,
  },
  yearMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  yearArrow: {
    padding: 4,
  },
  yearText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginLeft: 8,
  },
  monthText: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: '#fff',
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
