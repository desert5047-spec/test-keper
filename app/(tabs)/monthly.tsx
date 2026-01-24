import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';

interface MonthSummary {
  year: number;
  month: number;
  totalRecords: number;
  subjectStats: {
    subject: string;
    averageScore: number | null;
    totalCount: number;
  }[];
}

export default function MonthlyScreen() {
  const router = useRouter();
  const { year: contextYear, month: contextMonth, setYearMonth } = useDateContext();
  const [year, setYear] = useState(contextYear);
  const [selectedMonth, setSelectedMonth] = useState(contextMonth);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthSummary[]>([]);
  const [displayCount, setDisplayCount] = useState(3);

  useFocusEffect(
    useCallback(() => {
      loadMonthlySummaries();
    }, [year, selectedMonth])
  );

  const loadMonthlySummaries = async () => {
    const { data: allRecords } = await supabase
      .from('records')
      .select('*')
      .order('date', { ascending: false });

    if (!allRecords || allRecords.length === 0) {
      setMonthlySummaries([]);
      return;
    }

    const monthlyData: Record<string, TestRecord[]> = {};

    allRecords.forEach((record) => {
      const date = new Date(record.date);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!monthlyData[key]) {
        monthlyData[key] = [];
      }
      monthlyData[key].push(record);
    });

    const currentMonthKey = `${year}-${selectedMonth}`;
    const targetDate = new Date(year, selectedMonth - 1);

    const relevantMonths: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(targetDate.getFullYear(), targetDate.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (monthlyData[key]) {
        relevantMonths.push(key);
      }
    }

    const summaries: MonthSummary[] = relevantMonths.map((key) => {
      const [year, month] = key.split('-').map(Number);
      const records = monthlyData[key];

      const subjectData: Record<
        string,
        { scores: number[]; totalCount: number }
      > = {};

      records.forEach((record) => {
        if (!subjectData[record.subject]) {
          subjectData[record.subject] = { scores: [], totalCount: 0 };
        }
        subjectData[record.subject].totalCount++;
        if (record.score !== null) {
          subjectData[record.subject].scores.push(record.score);
        }
      });

      const subjectStats = Object.keys(subjectData).map((subject) => {
        const { scores, totalCount } = subjectData[subject];
        const averageScore =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null;

        return {
          subject,
          averageScore,
          totalCount,
        };
      });

      return {
        year,
        month,
        totalRecords: records.length,
        subjectStats,
      };
    });

    setMonthlySummaries(summaries);
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

  const handleMonthCardPress = (year: number, month: number) => {
    router.push(`/(tabs)/list?year=${year}&month=${month}`);
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

  const renderMonthCard = (summary: MonthSummary, index: number) => {
    return (
      <TouchableOpacity
        key={`${summary.year}-${summary.month}`}
        style={styles.card}
        onPress={() => handleMonthCardPress(summary.year, summary.month)}
        activeOpacity={0.7}>
        <Text style={styles.cardTitle}>
          {summary.year}年{summary.month}月の記録
        </Text>
        <Text style={styles.totalText}>
          この月は合計{summary.totalRecords}件の記録が残っています
        </Text>

        {summary.subjectStats.length > 0 && (
          <View style={styles.subjectStatsContainer}>
            {summary.subjectStats.map((stat) => (
              <View key={stat.subject} style={styles.subjectStatRow}>
                <View style={[styles.subjectChip, { backgroundColor: getSubjectColor(stat.subject) }]}>
                  <Text style={styles.subjectChipText}>{stat.subject}</Text>
                </View>
                <Text style={styles.subjectStatText}>
                  {stat.averageScore !== null
                    ? `平均${stat.averageScore}点、`
                    : ''}
                  {stat.totalCount}件
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const visibleSummaries = monthlySummaries.slice(0, displayCount);
  const hasMore = monthlySummaries.length > displayCount;

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

      {monthlySummaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>まだ記録がありません</Text>
          <Text style={styles.emptySubText}>
            ＋ボタンから記録を残しましょう
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {visibleSummaries.map((summary, index) => renderMonthCard(summary, index))}
          {hasMore && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setDisplayCount(displayCount + 3)}
              activeOpacity={0.7}>
              <Text style={styles.showMoreText}>さらに表示</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#333',
    marginBottom: 8,
  },
  totalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  subjectStatsContainer: {
    marginTop: 16,
    gap: 10,
  },
  subjectStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
  },
  subjectStatText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Nunito-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
  showMoreButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  showMoreText: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#4A90E2',
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
