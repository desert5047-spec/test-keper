import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';

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
  const { year, month } = useDateContext();
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();
  const [monthlySummaries, setMonthlySummaries] = useState<MonthSummary[]>([]);
  const [displayCount, setDisplayCount] = useState(3);

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId && isFamilyReady && familyId) {
        loadMonthlySummaries();
      }
    }, [year, month, selectedChildId, isFamilyReady, familyId])
  );

  const loadMonthlySummaries = async () => {
    if (!selectedChildId || !isFamilyReady || !familyId) return;

    const { data: allRecords } = await supabase
      .from('records')
      .select('*')
      .eq('child_id', selectedChildId)
      .eq('family_id', familyId)
      .order('date', { ascending: false });

    const monthlyData: Record<string, TestRecord[]> = {};

    if (allRecords && allRecords.length > 0) {
      allRecords.forEach((record) => {
        const date = new Date(record.date);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

        if (!monthlyData[key]) {
          monthlyData[key] = [];
        }
        monthlyData[key].push(record);
      });
    }

    const targetDate = new Date(year, month - 1);
    const summaries: MonthSummary[] = [];

    for (let i = 0; i < 12; i++) {
      const d = new Date(targetDate.getFullYear(), targetDate.getMonth() - i);
      const monthYear = d.getFullYear();
      const monthMonth = d.getMonth() + 1;
      const key = `${monthYear}-${monthMonth}`;

      const records = monthlyData[key] || [];

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

      summaries.push({
        year: monthYear,
        month: monthMonth,
        totalRecords: records.length,
        subjectStats,
      });
    }

    setMonthlySummaries(summaries);
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
      '英語': '#2C3E50',
      '生活': '#9B59B6',
      '図工': '#F39C12',
      '音楽': '#1ABC9C',
      '体育': '#E91E63',
    };
    return colors[subject] || '#95A5A6';
  };

  const renderMonthCard = (summary: MonthSummary, index: number) => {
    const hasRecords = summary.totalRecords > 0;

    return (
      <TouchableOpacity
        key={`${summary.year}-${summary.month}`}
        style={styles.card}
        onPress={() => handleMonthCardPress(summary.year, summary.month)}
        activeOpacity={0.7}>
        <Text style={styles.cardTitle}>
          {summary.year}年{summary.month}月の記録
        </Text>

        {hasRecords ? (
          <>
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
          </>
        ) : (
          <Text style={styles.noRecordsText}>記録がありません</Text>
        )}
      </TouchableOpacity>
    );
  };

  const visibleSummaries = monthlySummaries.slice(0, displayCount);
  const hasMore = monthlySummaries.length > displayCount;

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {monthlySummaries.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>まだ記録がありません</Text>
          <Text style={styles.emptySubText}>
            ＋ボタンから記録を残しましょう
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 16 }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
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
  noRecordsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
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
});
