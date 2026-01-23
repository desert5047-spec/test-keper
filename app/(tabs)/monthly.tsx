import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';

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
  const [monthlySummaries, setMonthlySummaries] = useState<MonthSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadMonthlySummaries();
    }, [])
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

    const summaries: MonthSummary[] = Object.keys(monthlyData)
      .sort((a, b) => {
        const [yearA, monthA] = a.split('-').map(Number);
        const [yearB, monthB] = b.split('-').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return monthB - monthA;
      })
      .slice(0, 12)
      .map((key) => {
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

  const handleMonthCardPress = (year: number, month: number) => {
    router.push(`/(tabs)/list?year=${year}&month=${month}`);
  };

  const renderMonthCard = (summary: MonthSummary) => {
    return (
      <TouchableOpacity
        key={`${summary.year}-${summary.month}`}
        style={styles.card}
        onPress={() => handleMonthCardPress(summary.year, summary.month)}
        activeOpacity={0.8}>
        <Text style={styles.cardTitle}>
          {summary.year}年{summary.month}月の記録
        </Text>
        <Text style={styles.totalText}>
          今月は合計{summary.totalRecords}件の記録が残っています
        </Text>

        {summary.subjectStats.length > 0 && (
          <View style={styles.subjectStatsContainer}>
            {summary.subjectStats.map((stat) => (
              <Text key={stat.subject} style={styles.subjectStatText}>
                [{stat.subject}]{' '}
                {stat.averageScore !== null
                  ? `平均${stat.averageScore}点 `
                  : ''}
                （登録{stat.totalCount}件）
              </Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>月の記録</Text>
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
          {monthlySummaries.map((summary) => renderMonthCard(summary))}
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
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    color: '#333',
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
    marginTop: 12,
    gap: 8,
  },
  subjectStatText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Nunito-Regular',
    lineHeight: 22,
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
});
