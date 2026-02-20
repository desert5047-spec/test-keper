import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';
import { logLoadError } from '@/lib/logger';

const LOAD_ERROR_MESSAGE = '通信できません。接続を確認して再度お試しください';

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
  const [stableSummaries, setStableSummaries] = useState<MonthSummary[]>([]);
  const [displayCount, setDisplayCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<'offline' | 'unknown' | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadMonthlySummaries = useCallback(async () => {
    if (!selectedChildId || !isFamilyReady || !familyId) {
      setLoading(false);
      return;
    }

    setLoadError(null);
    setLoading(true);

    try {
      const { data: allRecords, error } = await supabase
        .from('records')
        .select('*')
        .eq('child_id', selectedChildId)
        .eq('family_id', familyId)
        .or('score.not.is.null,stamp.not.is.null,photo_uri.not.is.null')
        .order('date', { ascending: false });

      if (error) {
        const isNetwork = String(error?.message ?? '').includes('Network request failed');
        logLoadError('記録読み込み');
        setLoadError(isNetwork ? 'offline' : 'unknown');
        return;
        // monthlySummaries / stableSummaries は上書きしない
      }

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
          const maxScore = record.max_score ?? 100;
          const normalizedScore = maxScore > 0
            ? (record.score / maxScore) * 100
            : record.score;
          subjectData[record.subject].scores.push(normalizedScore);
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
      setStableSummaries(summaries);
      setLoadError(null);
      setLastUpdatedAt(new Date());
    } catch (e) {
      const isNetwork = String(e).includes('Network request failed');
      logLoadError('記録読み込み');
      setLoadError(isNetwork ? 'offline' : 'unknown');
      // monthlySummaries / stableSummaries は上書きしない
    } finally {
      setHasLoadedOnce(true);
      setLoading(false);
    }
  }, [year, month, selectedChildId, isFamilyReady, familyId]);

  useEffect(() => {
    loadMonthlySummaries();
  }, [loadMonthlySummaries]);

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
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>
            {summary.year}年{summary.month}月のテスト平均
          </Text>
          {hasRecords ? (
            <Text style={styles.totalText}>{summary.totalRecords}件</Text>
          ) : null}
        </View>

        {hasRecords ? (
          <>
            {summary.subjectStats.length > 0 && (
              <View style={styles.subjectStatsContainer}>
                {summary.subjectStats.map((stat) => (
                  <View key={stat.subject} style={styles.subjectStatRow}>
                    <View style={styles.subjectChip}>
                      <Text style={styles.subjectChipText}>{stat.subject}テスト</Text>
                    </View>
                    {stat.averageScore !== null ? (
                      <Text style={styles.subjectStatText}>
                        <Text style={styles.subjectScoreText}>{stat.averageScore}点</Text>
                        <Text>{`（${stat.totalCount}件）`}</Text>
                      </Text>
                    ) : (
                      <Text style={styles.subjectStatText}>{`${stat.totalCount}件`}</Text>
                    )}
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

  const formatLastUpdated = (d: Date) => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const showSpinner = !isFamilyReady || (stableSummaries.length === 0 && (!hasLoadedOnce || loading));
  const showEmptyState = isFamilyReady && hasLoadedOnce && !loading && stableSummaries.length === 0 && !loadError;
  const showLoadErrorFullScreen = hasLoadedOnce && loadError && !loading && stableSummaries.length === 0;
  const showBannerAndList = hasLoadedOnce && loadError && !loading && stableSummaries.length > 0;

  const displaySummaries = showBannerAndList ? stableSummaries : monthlySummaries;
  const visibleSummaries = displaySummaries.slice(0, displayCount);
  const hasMore = displaySummaries.length > displayCount;

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {showBannerAndList ? (
        <View style={styles.mainWithBanner}>
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText} numberOfLines={2}>
              通信できません{lastUpdatedAt ? `（最終更新: ${formatLastUpdated(lastUpdatedAt)}）` : ''}
            </Text>
            <TouchableOpacity
              style={styles.retryButtonSmall}
              onPress={() => loadMonthlySummaries()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>再試行</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingTop: 12, paddingBottom: 20 }]}
            showsVerticalScrollIndicator={false}
          >
            {visibleSummaries.map((summary, index) => renderMonthCard(summary, index))}
            {hasMore && (
              <TouchableOpacity
                style={styles.showMoreButton}
                onPress={() => setDisplayCount(displayCount + 3)}
                activeOpacity={0.7}
              >
                <Text style={styles.showMoreText}>さらに表示</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      ) : null}

      {showSpinner ? (
        <View style={[styles.loadingContainer, { paddingTop: HEADER_HEIGHT }]}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : showLoadErrorFullScreen ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>{LOAD_ERROR_MESSAGE}</Text>
          {lastUpdatedAt ? (
            <Text style={styles.lastUpdatedText}>最終更新: {formatLastUpdated(lastUpdatedAt)}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadMonthlySummaries()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : showEmptyState ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>記録がありません</Text>
          <Text style={styles.emptySubText}>
            ＋ボタンから記録を残しましょう
          </Text>
        </View>
      ) : !showBannerAndList && !showSpinner && !showLoadErrorFullScreen && !showEmptyState ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {visibleSummaries.map((summary, index) => renderMonthCard(summary, index))}
          {hasMore && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setDisplayCount(displayCount + 3)}
              activeOpacity={0.7}
            >
              <Text style={styles.showMoreText}>さらに表示</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      ) : null}
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
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#1e3a8a',
    marginBottom: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  totalText: {
    alignSelf: 'flex-start',
    fontSize: 12,
    color: '#1d4ed8',
    backgroundColor: '#EEF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 0,
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
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  subjectChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectChipText: {
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
  subjectStatText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Nunito-Regular',
  },
  subjectScoreText: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    color: '#2563eb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  lastUpdatedText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    fontFamily: 'Nunito-Regular',
  },
  mainWithBanner: {
    flex: 1,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    fontFamily: 'Nunito-SemiBold',
  },
  retryButtonSmall: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    marginLeft: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
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
