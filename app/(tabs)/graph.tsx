import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, useHeaderTop } from '@/components/AppHeader';
import { logLoadError } from '@/lib/logger';

interface ScoreRecord {
  id: string;
  date: string;
  subject: string;
  score: number;
  max_score: number;
}

const MAIN_SUBJECTS = ['国語', '算数', '数学', '理科', '社会', '英語'];

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '全体' },
  { key: '国語', label: '国語' },
  { key: '算数', label: '算数' },
  { key: '理科', label: '理科' },
  { key: '社会', label: '社会' },
  { key: '英語', label: '英語' },
  { key: 'other', label: 'その他' },
];

const COUNT_OPTIONS = [10, 20, 30];

const CHART_HEIGHT = 240;
const CHART_PAD = { top: 20, bottom: 20, left: 40, right: 16 };
const DOT_R = 7;
const DOT_R_NEWEST = 9;
const DOT_R_SEL = 10;
const SPARSE_THRESHOLD = 5;
const Y_TICKS = [0, 25, 50, 75, 100];

const DOT_COLORS: Record<string, string> = {
  '国語': '#E74C3C',
  '算数': '#3498DB',
  '数学': '#3498DB',
  '理科': '#27AE60',
  '社会': '#E67E22',
  '英語': '#8E44AD',
};
const OTHER_COLOR = '#95A5A6';

const TREND_LINE_STROKE_WIDTH = 1.2;

function getDotColor(subject: string): string {
  return DOT_COLORS[subject] ?? OTHER_COLOR;
}

function matchesFilter(subject: string, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'other') return !MAIN_SUBJECTS.includes(subject);
  if (filter === '算数') return subject === '算数' || subject === '数学';
  return subject === filter;
}

function normalizeScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return score;
  return (score / maxScore) * 100;
}

function formatRecordDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 補助線の色（全体はグレー系、教科フィルター時はその教科色を薄く） */
function getTrendLineStroke(filterKey: string): { color: string; opacity: number } {
  if (filterKey === 'all') {
    return { color: '#94A3B8', opacity: 0.42 };
  }
  if (filterKey === 'other') {
    return { color: '#9CA3AF', opacity: 0.38 };
  }
  const color = DOT_COLORS[filterKey] ?? '#4A90E2';
  return { color, opacity: 0.36 };
}

export default function GraphScreen() {
  const router = useRouter();
  const headerTop = useHeaderTop(true);
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();

  const [allRecords, setAllRecords] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<'offline' | 'unknown' | null>(null);

  const [filter, setFilter] = useState('all');
  const [count, setCount] = useState<number>(10);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const pointTappedRef = useRef(false);

  const loadRecords = useCallback(async (opts: { isRefresh?: boolean } = {}) => {
    const isRefresh = opts.isRefresh === true;
    if (!selectedChildId || !isFamilyReady || !familyId) {
      if (!isRefresh) setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from('records')
        .select('id, date, subject, score, max_score')
        .eq('child_id', selectedChildId)
        .eq('family_id', familyId)
        .not('score', 'is', null)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        const isNet = String(error?.message ?? '').includes('Network request failed');
        logLoadError('グラフデータ');
        setLoadError(isNet ? 'offline' : 'unknown');
        return;
      }
      if (data) {
        setAllRecords((data as ScoreRecord[]).reverse());
        setLoadError(null);
      }
    } catch (e) {
      const isNet = String(e).includes('Network request failed');
      logLoadError('グラフデータ');
      setLoadError(isNet ? 'offline' : 'unknown');
    } finally {
      setHasLoadedOnce(true);
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [selectedChildId, isFamilyReady, familyId]);

  const dataKeyRef = useRef('');
  useEffect(() => {
    const key = `${selectedChildId}-${familyId}`;
    if (key !== dataKeyRef.current) {
      dataKeyRef.current = key;
      loadRecords();
    }
  }, [selectedChildId, familyId, loadRecords]);

  useEffect(() => {
    setSelectedIndex(null);
  }, [filter, count]);

  const displayRecords = useMemo(() => {
    const filtered = allRecords.filter(r => matchesFilter(r.subject, filter));
    return filtered.slice(-count);
  }, [allRecords, filter, count]);

  const stats = useMemo(() => {
    if (displayRecords.length === 0) return null;
    const scores = displayRecords.map(r => normalizeScore(r.score, r.max_score));
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      count: displayRecords.length,
      max: Math.round(Math.max(...scores)),
      min: Math.round(Math.min(...scores)),
      avg: Math.round(sum / scores.length),
    };
  }, [displayRecords]);

  const plotWidth = chartWidth - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const chartPoints = useMemo(() => {
    if (chartWidth === 0 || displayRecords.length === 0) return [];
    const n = displayRecords.length;

    let effectiveWidth = plotWidth;
    let offsetX = 0;
    if (n > 1 && n <= SPARSE_THRESHOLD) {
      const ratio = n / (SPARSE_THRESHOLD + 1);
      effectiveWidth = plotWidth * ratio;
      offsetX = (plotWidth - effectiveWidth) / 2;
    }

    return displayRecords.map((r, i) => {
      const norm = normalizeScore(r.score, r.max_score);
      let x: number;
      if (n === 1) {
        x = CHART_PAD.left + plotWidth * 0.5;
      } else {
        x = CHART_PAD.left + offsetX + (i / (n - 1)) * effectiveWidth;
      }
      return {
        x,
        y: CHART_PAD.top + (1 - norm / 100) * plotHeight,
        color: getDotColor(r.subject),
        isNewest: i === n - 1,
      };
    });
  }, [displayRecords, chartWidth, plotWidth, plotHeight]);

  const trendLinePoints = useMemo(
    () => (chartPoints.length >= 2 ? chartPoints.map(p => `${p.x},${p.y}`).join(' ') : ''),
    [chartPoints]
  );

  const trendLineStroke = useMemo(() => {
    const { color, opacity } = getTrendLineStroke(filter);
    const dimmed = selectedIndex !== null;
    return { color, opacity: dimmed ? Math.min(opacity * 0.45, 0.2) : opacity };
  }, [filter, selectedIndex]);

  const handlePointPress = useCallback((index: number) => {
    pointTappedRef.current = true;
    setSelectedIndex(index);
  }, []);

  const handleChartBackgroundPress = useCallback(() => {
    if (pointTappedRef.current) {
      pointTappedRef.current = false;
      return;
    }
    setSelectedIndex(null);
  }, []);

  const selectedRecord = selectedIndex !== null ? displayRecords[selectedIndex] : null;

  const handleChartLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  const getFilterColor = (key: string): string => {
    if (key === 'all') return '#4A90E2';
    if (key === 'other') return OTHER_COLOR;
    return DOT_COLORS[key] ?? '#4A90E2';
  };

  if (!isFamilyReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const showSpinner = !hasLoadedOnce && loading;
  const showEmpty = hasLoadedOnce && !loading && allRecords.length === 0 && !loadError;
  const showError = hasLoadedOnce && loadError && allRecords.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={styles.container}>
        <AppHeader showYearMonthNav={false} safeTopByParent={true} />

        <View style={[styles.fixedGraphArea, { marginTop: headerTop + 8 }]}>
          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map(f => {
              const active = filter === f.key;
              const color = getFilterColor(f.key);
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.filterChip,
                    active && { backgroundColor: color, borderColor: color },
                  ]}
                  onPress={() => setFilter(f.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, active && { color: '#fff' }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Chart */}
          {showSpinner ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator size="large" color="#4A90E2" />
            </View>
          ) : showEmpty ? (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.emptyText}>点数の記録がありません</Text>
            </View>
          ) : showError ? (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.emptyText}>通信できません</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadRecords()}>
                <Text style={styles.retryButtonText}>再試行</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.chartContainer} onLayout={handleChartLayout}>
              {chartWidth > 0 && displayRecords.length > 0 ? (
                <Pressable onPress={handleChartBackgroundPress}>
                  <Svg width={chartWidth} height={CHART_HEIGHT}>
                    {Y_TICKS.map(tick => {
                      const y = CHART_PAD.top + (1 - tick / 100) * plotHeight;
                      return (
                        <React.Fragment key={tick}>
                          <Line
                            x1={CHART_PAD.left}
                            y1={y}
                            x2={chartWidth - CHART_PAD.right}
                            y2={y}
                            stroke="#E5E7EB"
                            strokeWidth={1}
                          />
                          <SvgText
                            x={CHART_PAD.left - 8}
                            y={y + 4}
                            textAnchor="end"
                            fontSize={11}
                            fill="#9CA3AF"
                          >
                            {tick}
                          </SvgText>
                        </React.Fragment>
                      );
                    })}
                    {trendLinePoints ? (
                      <Polyline
                        points={trendLinePoints}
                        fill="none"
                        stroke={trendLineStroke.color}
                        strokeWidth={TREND_LINE_STROKE_WIDTH}
                        strokeOpacity={trendLineStroke.opacity}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                    {chartPoints.map((p, i) => {
                      const isSelected = selectedIndex === i;
                      const baseR = p.isNewest ? DOT_R_NEWEST : DOT_R;
                      const r = isSelected ? DOT_R_SEL : baseR;
                      const dimmed = selectedIndex !== null && !isSelected;
                      return (
                        <React.Fragment key={i}>
                          {isSelected && (
                            <Circle
                              cx={p.x}
                              cy={p.y}
                              r={DOT_R_SEL + 4}
                              fill="none"
                              stroke={p.color}
                              strokeWidth={2}
                              opacity={0.3}
                            />
                          )}
                          {p.isNewest && !isSelected && (
                            <Circle
                              cx={p.x}
                              cy={p.y}
                              r={baseR + 5}
                              fill={p.color}
                              opacity={dimmed ? 0.06 : 0.15}
                            />
                          )}
                          <Circle
                            cx={p.x}
                            cy={p.y}
                            r={r}
                            fill={p.color}
                            opacity={dimmed ? 0.3 : 1}
                          />
                          <Circle
                            cx={p.x}
                            cy={p.y}
                            r={16}
                            fill="transparent"
                            onPress={() => handlePointPress(i)}
                          />
                        </React.Fragment>
                      );
                    })}
                  </Svg>
                </Pressable>
              ) : chartWidth > 0 && displayRecords.length === 0 ? (
                <View style={styles.chartPlaceholder}>
                  <Text style={styles.emptyText}>該当する記録がありません</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadRecords({ isRefresh: true })} />
          }
        >
          {/* Count selector */}
          <View style={styles.countRow}>
            {COUNT_OPTIONS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.countChip, count === c && styles.countChipActive]}
                onPress={() => setCount(c)}
                activeOpacity={0.7}
              >
                <Text style={[styles.countChipText, count === c && styles.countChipTextActive]}>
                  {c}件
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Detail card */}
          {selectedRecord && (
            <TouchableOpacity
              style={styles.detailCard}
              onPress={() => router.push(`/detail?id=${selectedRecord.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.detailInlineText}>
                <Text style={[styles.detailBullet, { color: getDotColor(selectedRecord.subject) }]}>● </Text>
                <Text style={styles.detailDateInline}>{formatRecordDate(selectedRecord.date)}　</Text>
                <Text style={styles.detailSubjectInline}>{selectedRecord.subject}　</Text>
                <Text style={styles.detailScoreMain}>{selectedRecord.score}</Text>
                <Text style={styles.detailScoreInline}>／{selectedRecord.max_score}点中</Text>
              </Text>
              <Text style={styles.detailArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* Summary stats */}
          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>表示件数</Text>
                <Text style={styles.statValue}>{stats.count}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>最高</Text>
                <Text style={styles.statValue}>{stats.max}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>最低</Text>
                <Text style={styles.statValue}>{stats.min}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: '#bbb' }]}>平均</Text>
                <Text style={[styles.statValue, styles.statValueMuted]}>{stats.avg}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  fixedGraphArea: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    backgroundColor: '#f8f8f8',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.04)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  listScroll: {
    flex: 1,
  },
  listScrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#6B7280',
  },
  chartContainer: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.06)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontFamily: 'Nunito-SemiBold',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4A90E2',
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  countChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  countChipActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  countChipText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: '#6B7280',
  },
  countChipTextActive: {
    color: '#fff',
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  detailInlineText: {
    flex: 1,
  },
  detailBullet: {
    fontSize: 20,
    color: '#4B5563',
    fontFamily: 'Nunito-SemiBold',
  },
  detailDateInline: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Nunito-SemiBold',
  },
  detailSubjectInline: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Nunito-Bold',
  },
  detailScoreMain: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Nunito-Bold',
  },
  detailScoreInline: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'Nunito-SemiBold',
  },
  detailArrow: {
    fontSize: 30,
    color: '#D1D5DB',
    fontFamily: 'Nunito-Bold',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.06)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Nunito-SemiBold',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    color: '#1F2937',
    fontFamily: 'Nunito-Bold',
  },
  statValueMuted: {
    color: '#9CA3AF',
    fontSize: 16,
  },
});
