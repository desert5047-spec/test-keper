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
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const monthScrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [selectedMonth, selectedYear])
  );

  useEffect(() => {
    setTimeout(() => {
      monthScrollRef.current?.scrollTo({ x: selectedMonth * 44, animated: true });
    }, 100);
  }, []);

  const loadRecords = async () => {
    const month = selectedMonth + 1;
    const startDate = `${selectedYear}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(selectedYear, month, 0);
    const endDateStr = `${selectedYear}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

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
    const hasPhoto = !!item.photo_uri;
    const subjectColor = getSubjectColor(item.subject);

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
        <View style={styles.cardContent}>
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

  const renderMonthChip = (monthIndex: number) => {
    const isSelected = monthIndex === selectedMonth;
    const isCurrentMonth = monthIndex === new Date().getMonth() && selectedYear === new Date().getFullYear();

    return (
      <TouchableOpacity
        key={monthIndex}
        style={[
          styles.monthChip,
          isSelected && styles.monthChipSelected,
          isCurrentMonth && styles.monthChipCurrent,
        ]}
        onPress={() => setSelectedMonth(monthIndex)}
        activeOpacity={0.7}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.yearText}>{selectedYear}年</Text>
        <ScrollView
          ref={monthScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthSelector}
          style={styles.monthScrollView}>
          {Array.from({ length: 12 }, (_, i) => renderMonthChip(i))}
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
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  yearText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 12,
  },
  monthScrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  monthSelector: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  monthChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  monthChipSelected: {
    backgroundColor: '#4A90E2',
  },
  monthChipCurrent: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    minHeight: 80,
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
  cardFirstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
  },
  typeText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Nunito-Regular',
    marginTop: 2,
  },
  evaluationText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Nunito-Bold',
  },
  dateText: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
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
