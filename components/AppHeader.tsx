import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform, ActivityIndicator, Pressable } from 'react-native';
import { Settings, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Edit3, Trash2, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChildSwitcher } from './ChildSwitcher';
import { useDateContext } from '@/contexts/DateContext';

// ヘッダーバー高さ（外枠 = insets.top + HEADER_HEIGHT）
export const HEADER_HEIGHT = 52;
const BG = '#FFFFFF';

/** コンテンツの paddingTop 用。SafeArea + ヘッダー高さ */
export function useHeaderTop(): number {
  const insets = useSafeAreaInsets();
  return insets.top + HEADER_HEIGHT;
}

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
  /** SafeAreaView edges={['top']} で親が top を吸収している場合 true。Header の高さ・margin を調整 */
  safeTopByParent?: boolean;
  /** 編集モード: ✖(キャンセル) + 保存ボタン */
  showCancel?: boolean;
  showSave?: boolean;
  onCancel?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
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
  onDelete,
  safeTopByParent = false,
  showCancel = false,
  showSave = false,
  onCancel,
  onSave,
  isSaving = false,
  saveDisabled = false,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { year, month, setYearMonth } = useDateContext();
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    if (showMonthPicker) setPickerYear(year);
  }, [showMonthPicker, year]);

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
    setYearMonth(pickerYear, selectedMonth);
    setShowMonthPicker(false);
  };

  const handlePickerYearChange = (direction: 'next' | 'prev') => {
    setPickerYear((y) => (direction === 'next' ? y + 1 : y - 1));
  };

  const handleBack = () => {
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
  };

  const headerTopInset = safeTopByParent ? 0 : insets.top;
  const headerOuterHeight = headerTopInset + HEADER_HEIGHT;

  const isEditMode = showCancel && showSave;

  return (
    <>
      <View
        style={[
          styles.headerOuter,
          {
            paddingTop: headerTopInset,
            height: headerOuterHeight,
            backgroundColor: BG,
            borderBottomColor: isEditMode ? '#eee' : '#F0F0F0',
          },
        ]}>
        <View style={[styles.headerRow, { height: HEADER_HEIGHT }]}>
          {isEditMode ? (
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.6}
              style={styles.editCancelButton}
              {...(Platform.OS === 'web' && { cursor: 'pointer' } as any)}>
              <View style={styles.editCancelButtonInner}>
                <X size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : showBack ? (
            <View style={styles.hit}>
              <TouchableOpacity onPress={handleBack} style={styles.hitTouchable} activeOpacity={0.7}>
                <ArrowLeft size={22} color="#333" />
              </TouchableOpacity>
            </View>
          ) : showChildSwitcher ? (
            <View style={styles.leftFlex}>
              <ChildSwitcher />
            </View>
          ) : (
            <View style={styles.hit} />
          )}

          {isEditMode ? (
            <View style={styles.titleSpacer} />
          ) : showYearMonthNav ? (
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
          ) : title ? (
            <Text style={styles.title}>{title}</Text>
          ) : (
            <View style={styles.titleSpacer} />
          )}

          <View style={styles.rightRow}>
            {isEditMode ? (
              <Pressable
                onPress={onSave}
                disabled={saveDisabled || isSaving}
                style={[
                  styles.editSaveButton,
                  (saveDisabled || isSaving) && styles.editSaveButtonDisabled,
                ]}
                {...(Platform.OS === 'web' && { cursor: saveDisabled || isSaving ? 'default' : 'pointer' } as any)}>
                {isSaving && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
                <Text style={styles.editSaveButtonText}>{isSaving ? '保存中...' : '保存'}</Text>
              </Pressable>
            ) : (
              <>
                {showEdit && onEdit && (
                  <TouchableOpacity onPress={onEdit} style={styles.hit} activeOpacity={0.7}>
                    <Edit3 size={20} color="#666" />
                  </TouchableOpacity>
                )}
                {showDelete && onDelete && (
                  <TouchableOpacity onPress={onDelete} style={styles.hit} activeOpacity={0.7}>
                    <Trash2 size={20} color="#666" />
                  </TouchableOpacity>
                )}
                {showSettings && (
                  <TouchableOpacity
                    onPress={() => router.push('/settings')}
                    style={styles.hit}
                    activeOpacity={0.7}>
                    <Settings size={24} color="#666" />
                  </TouchableOpacity>
                )}
                {!showEdit && !showDelete && !showSettings && <View style={styles.hit} />}
              </>
            )}
          </View>
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
          <TouchableOpacity
            style={styles.monthPickerContainer}
            activeOpacity={1}
            onPress={() => {}}>
            <Text style={styles.monthPickerTitle}>年・月を選択</Text>
            <View style={styles.yearPickerRow}>
              <TouchableOpacity
                style={styles.yearPickerArrow}
                onPress={() => handlePickerYearChange('prev')}
                activeOpacity={0.7}>
                <ChevronLeft size={22} color="#666" />
              </TouchableOpacity>
              <Text style={styles.yearPickerText}>{pickerYear}年</Text>
              <TouchableOpacity
                style={styles.yearPickerArrow}
                onPress={() => handlePickerYearChange('next')}
                activeOpacity={0.7}>
                <ChevronRight size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.monthPickerScroll}>
              <View style={styles.monthPickerGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.monthPickerItem,
                      pickerYear === year && month === m && styles.monthPickerItemSelected,
                    ]}
                    onPress={() => handleMonthSelect(m)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.monthPickerItemText,
                        pickerYear === year && month === m && styles.monthPickerItemTextSelected,
                      ]}>
                      {m}月
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hit: {
    width: 44,
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' as const }),
  },
  hitTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && { cursor: 'pointer' as const }),
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#333',
    lineHeight: 22,
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  titleSpacer: {
    width: 44,
  },
  leftFlex: {
    minWidth: 44,
    alignItems: 'flex-start',
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
    backgroundColor: '#FFFFFF',
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
  yearPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  yearPickerArrow: {
    padding: 4,
  },
  yearPickerText: {
    fontSize: 17,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    minWidth: 72,
    textAlign: 'center',
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
  editCancelButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
  },
  editSaveButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  editSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Nunito-SemiBold',
  },
});
