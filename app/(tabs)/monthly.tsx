import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useChild } from '@/contexts/ChildContext';
import { getSubjectColor } from '@/lib/subjects';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, useHeaderTop } from '@/components/AppHeader';
import { logLoadError } from '@/lib/logger';

const LOAD_ERROR_MESSAGE = '通信できません。接続を確認して再度お試しください';
const SUBJECT_ORDER = ['国語', '算数', '理科', '社会', '英語', 'その他'] as const;
const MODE_OPTIONS = [
  { key: 'month', label: '月' },
  { key: 'half', label: '半期' },
  { key: 'year', label: '年間' },
] as const;
const HALF_OPTIONS = [
  { key: 'first', label: '上期' },
  { key: 'second', label: '下期' },
] as const;

type PeriodMode = (typeof MODE_OPTIONS)[number]['key'];
type HalfMode = (typeof HALF_OPTIONS)[number]['key'];

interface SubjectSummaryRow {
  key: (typeof SUBJECT_ORDER)[number];
  averageScore: number | null;
  totalCount: number;
  barValue: number;
}

function normalizeScore(score: number, maxScore: number | null): number {
  const max = maxScore ?? 100;
  if (max <= 0) return score;
  return (score / max) * 100;
}

function toSubjectBucket(subject: string): (typeof SUBJECT_ORDER)[number] {
  if (subject === '算数' || subject === '数学') return '算数';
  if (subject === '国語' || subject === '理科' || subject === '社会' || subject === '英語') return subject;
  return 'その他';
}

function getSchoolYearFromDate(d: Date): number {
  const month = d.getMonth() + 1;
  return month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDateRange(mode: PeriodMode, schoolYear: number, selectedMonth: number, selectedHalf: HalfMode) {
  if (mode === 'year') {
    return { start: new Date(schoolYear, 3, 1), end: new Date(schoolYear + 1, 2, 31) };
  }
  if (mode === 'half') {
    if (selectedHalf === 'first') {
      return { start: new Date(schoolYear, 3, 1), end: new Date(schoolYear, 8, 30) };
    }
    return { start: new Date(schoolYear, 9, 1), end: new Date(schoolYear + 1, 2, 31) };
  }
  const calendarYear = selectedMonth >= 4 ? schoolYear : schoolYear + 1;
  return { start: new Date(calendarYear, selectedMonth - 1, 1), end: new Date(calendarYear, selectedMonth, 0) };
}

export default function MonthlyScreen() {
  const router = useRouter();
  const headerTop = useHeaderTop(true);
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();

  const now = new Date();
  const initialMonth = now.getMonth() + 1;

  const [mode, setMode] = useState<PeriodMode>('month');
  const [selectedYear, setSelectedYear] = useState<number>(getSchoolYearFromDate(now));
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [selectedHalf, setSelectedHalf] = useState<HalfMode>(initialMonth >= 10 || initialMonth <= 3 ? 'second' : 'first');

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedYear);

  useEffect(() => {
    if (showMonthPicker) setPickerYear(selectedYear);
  }, [showMonthPicker, selectedYear]);

  const handleMonthSelect = useCallback((m: number) => {
    const schoolYear = m >= 4 ? pickerYear : pickerYear - 1;
    setSelectedYear(schoolYear);
    setSelectedMonth(m);
    setMode('month');
    setShowMonthPicker(false);
  }, [pickerYear]);

  const handlePickerYearChange = useCallback((direction: 'next' | 'prev') => {
    setPickerYear((y) => (direction === 'next' ? y + 1 : y - 1));
  }, []);

  const pickerDisplayYear = useMemo(() => {
    if (mode === 'month') {
      return selectedMonth >= 4 ? selectedYear : selectedYear + 1;
    }
    return selectedYear;
  }, [mode, selectedYear, selectedMonth]);

  const [subjectRows, setSubjectRows] = useState<SubjectSummaryRow[]>([]);
  const [stableRows, setStableRows] = useState<SubjectSummaryRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [stableTotalRecords, setStableTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<'offline' | 'unknown' | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadSubjectSummaries = useCallback(async () => {
    if (!selectedChildId || !isFamilyReady || !familyId) {
      setLoading(false);
      return;
    }

    setLoadError(null);
    setLoading(true);

    try {
      const { start, end } = getDateRange(mode, selectedYear, selectedMonth, selectedHalf);
      const startDate = formatYmd(start);
      const endDateStr = formatYmd(end);

      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('child_id', selectedChildId)
        .eq('family_id', familyId)
        .or('score.not.is.null,stamp.not.is.null,photo_uri.not.is.null')
        .gte('date', startDate)
        .lte('date', endDateStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        const isNetwork = String(error?.message ?? '').includes('Network request failed');
        logLoadError('記録読み込み');
        setLoadError(isNetwork ? 'offline' : 'unknown');
        return;
      }

      const bucketMap: Record<(typeof SUBJECT_ORDER)[number], { count: number; scoreValues: number[] }> = {
        国語: { count: 0, scoreValues: [] },
        算数: { count: 0, scoreValues: [] },
        理科: { count: 0, scoreValues: [] },
        社会: { count: 0, scoreValues: [] },
        英語: { count: 0, scoreValues: [] },
        その他: { count: 0, scoreValues: [] },
      };

      (data ?? []).forEach((record: TestRecord) => {
        const bucket = toSubjectBucket(record.subject);
        bucketMap[bucket].count += 1;
        if (record.score !== null) {
          bucketMap[bucket].scoreValues.push(normalizeScore(record.score, record.max_score));
        }
      });

      const nextRows: SubjectSummaryRow[] = SUBJECT_ORDER.map((subjectKey) => {
        const bucket = bucketMap[subjectKey];
        const hasScore = bucket.scoreValues.length > 0;
        const averageScore = hasScore
          ? Math.round(bucket.scoreValues.reduce((a, b) => a + b, 0) / bucket.scoreValues.length)
          : null;

        return {
          key: subjectKey,
          averageScore,
          totalCount: bucket.count,
          barValue: averageScore ?? 0,
        };
      });

      setSubjectRows(nextRows);
      setStableRows(nextRows);
      setTotalRecords((data ?? []).length);
      setStableTotalRecords((data ?? []).length);
      setLoadError(null);
      setLastUpdatedAt(new Date());
    } catch (e) {
      const isNetwork = String(e).includes('Network request failed');
      logLoadError('記録読み込み');
      setLoadError(isNetwork ? 'offline' : 'unknown');
    } finally {
      setHasLoadedOnce(true);
      setLoading(false);
    }
  }, [mode, selectedYear, selectedMonth, selectedHalf, selectedChildId, isFamilyReady, familyId]);

  useFocusEffect(
    useCallback(() => {
      loadSubjectSummaries();
    }, [loadSubjectSummaries])
  );

  const summaryCaption = useMemo(() => {
    if (mode === 'year') return `${selectedYear}.4～${selectedYear + 1}.3`;
    if (mode === 'half') {
      if (selectedHalf === 'first') return `${selectedYear}.4～${selectedYear}.9`;
      return `${selectedYear}.10～${selectedYear + 1}.3`;
    }
    const calendarYear = selectedMonth >= 4 ? selectedYear : selectedYear + 1;
    return `${calendarYear}.${selectedMonth}`;
  }, [mode, selectedYear, selectedMonth, selectedHalf]);

  const handleModeChange = useCallback((newMode: PeriodMode) => {
    if (newMode === 'half') {
      const isSecondHalf = selectedMonth >= 10 || selectedMonth <= 3;
      setSelectedHalf(isSecondHalf ? 'second' : 'first');
    }
    setMode(newMode);
  }, [selectedMonth]);

  const shiftPeriod = useCallback((direction: 'prev' | 'next') => {
    if (mode === 'year') {
      setSelectedYear((y) => (direction === 'next' ? y + 1 : y - 1));
      return;
    }

    if (mode === 'half') {
      setSelectedHalf((current) => {
        if (direction === 'next') {
          if (current === 'first') return 'second';
          setSelectedYear((y) => y + 1);
          return 'first';
        }
        if (current === 'second') return 'first';
        setSelectedYear((y) => y - 1);
        return 'second';
      });
      return;
    }

    setSelectedMonth((m) => {
      if (direction === 'next') {
        if (m === 3) {
          setSelectedYear((y) => y + 1);
          return 4;
        }
        return m === 12 ? 1 : m + 1;
      }
      if (m === 4) {
        setSelectedYear((y) => y - 1);
        return 3;
      }
      return m === 1 ? 12 : m - 1;
    });
  }, [mode]);

  const handleSubjectPress = useCallback(
    (subject: (typeof SUBJECT_ORDER)[number]) => {
      const queryYear = mode === 'month'
        ? (selectedMonth >= 4 ? selectedYear : selectedYear + 1)
        : selectedYear;
      router.push(
        `/(tabs)/list?mode=${mode}&year=${queryYear}&month=${selectedMonth}&half=${selectedHalf}&subject=${encodeURIComponent(subject)}`
      );
    },
    [router, mode, selectedYear, selectedMonth, selectedHalf]
  );

  const formatLastUpdated = (d: Date) => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const showSpinner = !isFamilyReady || (stableRows.length === 0 && (!hasLoadedOnce || loading));
  const showEmptyState = isFamilyReady && hasLoadedOnce && !loading && stableTotalRecords === 0 && !loadError;
  const showLoadErrorFullScreen = hasLoadedOnce && loadError && !loading && stableRows.length === 0;
  const showBannerAndList = hasLoadedOnce && loadError && !loading && stableRows.length > 0;

  const displayRows = showBannerAndList ? stableRows : subjectRows;
  const displayTotalRecords = showBannerAndList ? stableTotalRecords : totalRecords;

  const renderRows = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingTop: 4 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.periodCard}>
        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.modeChip, active && styles.modeChipActive]}
                onPress={() => handleModeChange(opt.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {mode === 'half' ? (
          <View style={styles.halfRow}>
            {HALF_OPTIONS.map((opt) => {
              const active = selectedHalf === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.halfChip, active && styles.halfChipActive]}
                  onPress={() => setSelectedHalf(opt.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.halfChipText, active && styles.halfChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View style={styles.periodSelectorRow}>
          <TouchableOpacity style={styles.periodArrowButton} onPress={() => shiftPeriod('prev')} activeOpacity={0.7}>
            <ChevronLeft size={18} color="#4B5563" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.periodLabelWrap} onPress={() => setShowMonthPicker(true)} activeOpacity={0.7}>
            <Text style={styles.periodLabelText}>{summaryCaption} ▼</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.periodArrowButton} onPress={() => shiftPeriod('next')} activeOpacity={0.7}>
            <ChevronRight size={18} color="#4B5563" />
          </TouchableOpacity>
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                  const isActive = mode === 'month' && pickerYear === pickerDisplayYear && selectedMonth === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.monthPickerItem, isActive && styles.monthPickerItemSelected]}
                      onPress={() => handleMonthSelect(m)}
                      activeOpacity={0.7}>
                      <Text style={[styles.monthPickerItemText, isActive && styles.monthPickerItemTextSelected]}>
                        {m}月
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.subjectList}>
        {displayRows.map((row) => {
          const color = row.key === 'その他' ? '#9CA3AF' : getSubjectColor(row.key);
          const scoreText = row.averageScore !== null ? `${row.averageScore}` : '—';
          return (
            <TouchableOpacity
              key={row.key}
              style={styles.subjectCard}
              onPress={() => handleSubjectPress(row.key)}
              activeOpacity={0.75}
            >
              <View style={styles.subjectLeft}>
                <View style={[styles.subjectBadge, { backgroundColor: color }]}>
                  <Text style={styles.subjectBadgeText}>{row.key}</Text>
                </View>
                <Text style={styles.countText}>{row.totalCount}件</Text>
              </View>

              <View style={styles.barWrap}>
                <View style={styles.barTrack}>
                  {row.averageScore !== null ? (
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(0, Math.min(100, row.barValue))}%`, backgroundColor: color },
                      ]}
                    />
                  ) : null}
                </View>
              </View>

              <View style={styles.scoreWrap}>
                <Text style={styles.scoreText}>{scoreText}</Text>
                <Text style={styles.scoreUnit}>/100</Text>
              </View>

              <View style={styles.cardArrow}>
                <ChevronRight size={16} color="#C5C9D0" />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {displayTotalRecords > 0 ? (
        <Text style={styles.totalCountFooter}>合計 {displayTotalRecords}件</Text>
      ) : null}
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={styles.container}>
        <AppHeader showYearMonthNav={false} safeTopByParent={true} />

        {showBannerAndList ? (
          <View style={styles.mainWithBanner}>
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText} numberOfLines={2}>
                通信できません{lastUpdatedAt ? `（最終更新: ${formatLastUpdated(lastUpdatedAt)}）` : ''}
              </Text>
              <TouchableOpacity
                style={styles.retryButtonSmall}
                onPress={() => loadSubjectSummaries()}
                activeOpacity={0.7}
              >
                <Text style={styles.retryButtonText}>再試行</Text>
              </TouchableOpacity>
            </View>
            {renderRows()}
          </View>
        ) : null}

        {showSpinner ? (
          <View style={[styles.loadingContainer, { paddingTop: headerTop + 8 }]}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : showLoadErrorFullScreen ? (
          <View style={[styles.emptyContainer, { paddingTop: headerTop + 8 }]}>
            <Text style={styles.emptyText}>{LOAD_ERROR_MESSAGE}</Text>
            {lastUpdatedAt ? (
              <Text style={styles.lastUpdatedText}>最終更新: {formatLastUpdated(lastUpdatedAt)}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadSubjectSummaries()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : !showBannerAndList && !showSpinner && !showLoadErrorFullScreen ? (
          <View style={{ flex: 1, paddingTop: headerTop + 8 }}>
            {renderRows()}
            {showEmptyState ? (
              <View style={styles.emptyInlineContainer}>
                <Text style={styles.emptyText}>記録がありません</Text>
                <Text style={styles.emptySubText}>＋ボタンから記録を残しましょう</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  periodCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  modeChipActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  modeChipText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Nunito-SemiBold',
  },
  modeChipTextActive: {
    color: '#fff',
  },
  halfRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  halfChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  halfChipActive: {
    backgroundColor: '#EEF6FF',
    borderColor: '#93C5FD',
  },
  halfChipText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Nunito-SemiBold',
  },
  halfChipTextActive: {
    color: '#1D4ED8',
  },
  periodSelectorRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelText: {
    fontSize: 15,
    color: '#111827',
    fontFamily: 'Nunito-SemiBold',
  },
  totalCountFooter: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Nunito-Regular',
    marginTop: 12,
  },
  subjectList: {
    gap: 8,
  },
  subjectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  subjectLeft: {
    width: 80,
    marginRight: 8,
  },
  subjectBadge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  subjectBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
  },
  countText: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Nunito-Regular',
  },
  barWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreWrap: {
    width: 56,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    marginLeft: 10,
  },
  scoreText: {
    fontSize: 17,
    color: '#111827',
    fontFamily: 'Nunito-Bold',
    minWidth: 24,
    textAlign: 'right',
  },
  scoreUnit: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 1,
    fontFamily: 'Nunito-Regular',
  },
  cardArrow: {
    marginLeft: 8,
    justifyContent: 'center',
    pointerEvents: 'none' as const,
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
    fontFamily: 'Nunito-SemiBold',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Nunito-Regular',
  },
  emptyInlineContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastUpdatedText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    fontFamily: 'Nunito-Regular',
  },
  mainWithBanner: {
    flex: 1,
    paddingTop: 0,
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
});
