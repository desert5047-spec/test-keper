import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { isValidImageUri } from '@/utils/imageGuard';

interface Section {
  title: string;
  data: TestRecord[];
}

export default function ListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { year: contextYear, month: contextMonth, setYearMonth } = useDateContext();
  const [year, setYear] = useState(contextYear);
  const [selectedMonth, setSelectedMonth] = useState(contextMonth);
  const [sections, setSections] = useState<Section[]>([]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  useEffect(() => {
    if (params.year && params.month) {
      const newYear = parseInt(params.year as string);
      const newMonth = parseInt(params.month as string);
      setYear(newYear);
      setSelectedMonth(newMonth);
      setYearMonth(newYear, newMonth);
    } else {
      setYear(contextYear);
      setSelectedMonth(contextMonth);
    }
  }, [params, contextYear, contextMonth]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [year, selectedMonth])
  );

  const loadRecords = async () => {
    const startDate = `${year}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endDate = new Date(year, selectedMonth, 0);
    const endDateStr = `${year}-${String(selectedMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      const grouped = data.reduce((acc, record) => {
        const dateKey = record.date;
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(record);
        return acc;
      }, {} as Record<string, TestRecord[]>);

      const sectionsData: Section[] = Object.keys(grouped)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({
          title: date,
          data: grouped[date],
        }));

      setSections(sectionsData);
    } else {
      setSections([]);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const formatEvaluation = (record: TestRecord) => {
    if (record.score !== null) {
      return `${record.score}点（${record.max_score}点中）`;
    }
    return record.stamp || '';
  };

  const getSubjectColor = (subject: string) => {
    const colors: { [key: string]: string } = {
      '国語': '#E74C3C',
      '算数': '#3498DB',
      '理科': '#27AE60',
      '社会': '#E67E22',
      '生活': '#9B59B6',
      '図工': '#F39C12',
      '音楽': '#1ABC9C',
      '体育': '#E91E63',
    };
    return colors[subject] || '#95A5A6';
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      const newYear = year - 1;
      setYear(newYear);
      setSelectedMonth(12);
      setYearMonth(newYear, 12);
    } else {
      const newMonth = selectedMonth - 1;
      setSelectedMonth(newMonth);
      setYearMonth(year, newMonth);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      const newYear = year + 1;
      setYear(newYear);
      setSelectedMonth(1);
      setYearMonth(newYear, 1);
    } else {
      const newMonth = selectedMonth + 1;
      setSelectedMonth(newMonth);
      setYearMonth(year, newMonth);
    }
  };

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month);
    setYearMonth(year, month);
    setShowMonthPicker(false);
  };

  const renderItem = ({ item }: { item: TestRecord }) => {
    const subjectColor = getSubjectColor(item.subject);
    const hasPhoto = !!item.photo_uri && isValidImageUri(item.photo_uri);

    if (item.photo_uri && !isValidImageUri(item.photo_uri)) {
      console.warn('[画像警告] 無効な画像URIが検出されました:', item.photo_uri);
    }

    return (
      <TouchableOpacity
        style={styles.recordItem}
        onPress={() => router.push(`/detail?id=${item.id}`)}
        activeOpacity={0.8}>
        <View style={styles.thumbnailContainer}>
          {hasPhoto ? (
            <View
              style={[
                styles.thumbnailWrapper,
                {
                  transform: [{ rotate: `${item.photo_rotation}deg` }],
                },
              ]}>
              <Image
                source={{ uri: item.photo_uri! }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.placeholderThumbnail} />
          )}
        </View>
        <View style={styles.recordContent}>
          <View style={styles.recordFirstRow}>
            <View style={[styles.subjectChip, { backgroundColor: subjectColor }]}>
              <Text style={styles.subjectChipText}>{item.subject}</Text>
            </View>
            <Text style={styles.evaluationText}>{formatEvaluation(item)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{formatDate(section.title)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.yearMonthSelector}>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={goToNextMonth}
            activeOpacity={0.7}>
            <ChevronLeft size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.yearText}>{year}年</Text>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => setShowMonthPicker(true)}
            activeOpacity={0.7}>
            <Text style={styles.monthText}>{selectedMonth}月</Text>
            <ChevronDown size={20} color="#666" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={goToPreviousMonth}
            activeOpacity={0.7}>
            <ChevronRight size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {year}年{selectedMonth}月の記録はありません
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
        />
      )}

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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.monthPickerItem,
                      selectedMonth === month && styles.monthPickerItemSelected,
                    ]}
                    onPress={() => handleMonthSelect(month)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.monthPickerItemText,
                        selectedMonth === month && styles.monthPickerItemTextSelected,
                      ]}>
                      {month}月
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  yearMonthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  yearButton: {
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
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#666',
  },
  recordItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 80,
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  thumbnailWrapper: {
    width: '100%',
    height: '100%',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e8e8e8',
  },
  recordContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  recordFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 26,
  },
  subjectChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    minHeight: 26,
    justifyContent: 'center',
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
    lineHeight: 14,
  },
  evaluationText: {
    fontSize: 15,
    color: '#333',
    fontFamily: 'Nunito-Bold',
    marginLeft: 10,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
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
