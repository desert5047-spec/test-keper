import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Settings, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Edit3, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChildSwitcher } from './ChildSwitcher';
import { useDateContext } from '@/contexts/DateContext';

export const HEADER_HEIGHT = Platform.select({
  web: 78,
  default: 102,
});

interface AppHeaderProps {
  showBack?: boolean;
  showSettings?: boolean;
  showChildSwitcher?: boolean;
  showYearMonthNav?: boolean;
  title?: string;
  showEdit?: boolean;
  showDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AppHeader({
  showBack = false,
  showSettings = true,
  showChildSwitcher = true,
  showYearMonthNav = false,
  title,
  showEdit = false,
  showDelete = false,
  onEdit,
  onDelete
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
              onPress={() => {
                const canGoBack = (router as { canGoBack?: () => boolean }).canGoBack?.();
                if (canGoBack) {
                  router.back();
                  return;
                }
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  if (window.history.length > 1) {
                    router.back();
                    return;
                  }
                }
                router.replace('/(tabs)');
              }}
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
          {showEdit && onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={styles.iconButton}
              activeOpacity={0.7}>
              <Edit3 size={20} color="#666" />
            </TouchableOpacity>
          )}
          {showDelete && onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={styles.iconButton}
              activeOpacity={0.7}>
              <Trash2 size={20} color="#666" />
            </TouchableOpacity>
          )}
          {showSettings && (
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={styles.iconButton}
              activeOpacity={0.7}>
              <Settings size={24} color="#666" />
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
    top: -1,
    left: 1,
    right: 0,
    backgroundColor: '#FFF',
    paddingTop: Platform.select({
      web: 20,
      default: 44,
    }),
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
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' as const }),
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
