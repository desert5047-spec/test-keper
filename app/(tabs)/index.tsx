import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { isValidImageUri } from '@/utils/imageGuard';

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { year: contextYear, month: contextMonth, setYearMonth } = useDateContext();
  const [selectedMonth, setSelectedMonth] = useState(contextMonth);
  const [selectedYear, setSelectedYear] = useState(contextYear);
  const monthScrollRef = useRef<ScrollView>(null);

  const months = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [selectedMonth, selectedYear])
  );

  useEffect(() => {
    const index = months.indexOf(selectedMonth);
    if (index !== -1) {
      setTimeout(() => {
        monthScrollRef.current?.scrollTo({ x: index * 56, animated: true });
      }, 100);
    }
  }, [selectedMonth]);

  const loadRecords = async () => {
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endDate = new Date(selectedYear, selectedMonth, 0);
    const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setRecords(data);
    }
  };

  const handleYearChange = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      const newYear = selectedYear + 1;
      setSelectedYear(newYear);
      setSelectedMonth(1);
      setYearMonth(newYear, 1);
    } else {
      const newYear = selectedYear - 1;
      setSelectedYear(newYear);
      setSelectedMonth(12);
      setYearMonth(newYear, 12);
    }
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setYearMonth(selectedYear, month);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
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

  const renderRecord = ({ item }: { item: TestRecord }) => {
    const hasPhoto = !!item.photo_uri && isValidImageUri(item.photo_uri);
    const subjectColor = getSubjectColor(item.subject);

    if (item.photo_uri && !isValidImageUri(item.photo_uri)) {
      console.warn('[画像警告] 無効な画像URIが検出されました:', item.photo_uri);
    }

    return (
      <TouchableOpacity
        style={[styles.card, !hasPhoto && styles.cardSmall]}
        onPress={() => router.push(`/detail?id=${item.id}`)}
        activeOpacity={0.8}>
        {hasPhoto && (
          <View style={styles.imageContainer}>
            <View
              style={[
                styles.imageWrapper,
                {
                  transform: [{ rotate: `${item.photo_rotation}deg` }],
                },
              ]}>
              <Image
                source={{ uri: item.photo_uri! }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.dateOverlay}>
              <Text style={styles.dateOverlayText}>{formatDate(item.date)}</Text>
            </View>
          </View>
        )}
        <View style={[styles.cardContent, !hasPhoto && styles.cardContentCompact]}>
          <View style={styles.cardFirstRow}>
            <View style={[styles.subjectChip, { backgroundColor: subjectColor }]}>
              <Text style={styles.subjectChipText}>{item.subject}</Text>
            </View>
            <Text style={styles.evaluationText}>{formatEvaluation(item)}</Text>
          </View>
          <Text style={styles.typeText}>{item.type}</Text>
          {!hasPhoto && (
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMonthChip = (month: number) => {
    const isSelected = month === selectedMonth;

    return (
      <TouchableOpacity
        key={month}
        style={[
          styles.monthChip,
          isSelected && styles.monthChipSelected,
        ]}
        onPress={() => handleMonthChange(month)}
        activeOpacity={0.7}>
        <Text style={[
          styles.monthText,
          isSelected && styles.monthTextSelected
        ]}>
          {month}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.yearSelector}>
          <TouchableOpacity
            style={styles.yearArrow}
            onPress={() => handleYearChange('next')}
            activeOpacity={0.7}>
            <ChevronLeft size={24} color="#4A90E2" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}年</Text>
          <TouchableOpacity
            style={styles.yearArrow}
            onPress={() => handleYearChange('prev')}
            activeOpacity={0.7}>
            <ChevronRight size={24} color="#4A90E2" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <ScrollView
          ref={monthScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthSelector}
          style={styles.monthScrollView}>
          {months.map((month) => renderMonthChip(month))}
        </ScrollView>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>まだ記録がありません</Text>
          <Text style={styles.emptySubText}>登録ボタンから記録を残しましょう</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  yearArrow: {
    padding: 4,
  },
  yearText: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    minWidth: 100,
    textAlign: 'center',
  },
  monthScrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  monthSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  monthChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthChipSelected: {
    backgroundColor: '#4A90E2',
  },
  monthText: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: '#888',
  },
  monthTextSelected: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSmall: {
    minHeight: 0,
  },
  imageContainer: {
    position: 'relative',
    height: 240,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  dateOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dateOverlayText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
  },
  cardContent: {
    padding: 16,
  },
  cardContentCompact: {
    padding: 12,
    paddingVertical: 10,
  },
  cardFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 28,
  },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    minHeight: 28,
    justifyContent: 'center',
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    lineHeight: 16,
  },
  typeText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Nunito-Regular',
  },
  evaluationText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Nunito-Bold',
    marginLeft: 12,
    lineHeight: 20,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontFamily: 'Nunito-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 17,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Nunito-SemiBold',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Nunito-Regular',
  },
});
