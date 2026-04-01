import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { isValidImageUri } from '@/utils/imageGuard';
import { getThumbImageUrl } from '@/lib/storage';
import { getStoragePathFromUrl } from '@/utils/imageUpload';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, useHeaderTop } from '@/components/AppHeader';
import { log, logLoadError, warn } from '@/lib/logger';

const LOAD_ERROR_MESSAGE = '通信できません。接続を確認して再度お試しください';
const UNKNOWN_ERROR_MESSAGE = '読み込みに失敗しました。しばらくして再度お試しください。';
const MAIN_SUBJECTS = ['国語', '算数', '数学', '理科', '社会', '英語'];
const SUBJECT_CHIPS = ['全体', '国語', '算数', '理科', '社会', '英語', 'その他'] as const;
const SUB_NAV_ROW1 = 44;
const SUB_NAV_ROW2 = 40;
const SUB_NAV_HEIGHT = SUB_NAV_ROW1 + SUB_NAV_ROW2;
type PeriodMode = 'month' | 'half' | 'year';
type HalfMode = 'first' | 'second';

type RecordWithImageUrl = TestRecord & { imageUrl: string | null };

interface Section {
  title: string;
  data: RecordWithImageUrl[];
}

function isLikelyNetworkError(err: unknown): boolean {
  const msg =
    typeof (err as { message?: string })?.message === 'string'
      ? (err as { message: string }).message
      : String(err ?? '');
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Load failed') ||
    msg.includes('TypeError')
  );
}

import { getSubjectColor } from '@/lib/subjects';

const THUMB_SIZE = 96;

interface ListRecordCardProps {
  item: RecordWithImageUrl;
  onPress: (id: string) => void;
}
const ListRecordCard = React.memo(function ListRecordCard({ item, onPress }: ListRecordCardProps) {
  const formatEvaluation = (r: TestRecord) =>
    r.score !== null ? `${r.score}点（${r.max_score}点中）` : (r.stamp || '');
  const subjectColor = getSubjectColor(item.subject);
  const photoUrl = item.imageUrl && isValidImageUri(item.imageUrl) ? item.imageUrl : null;

  return (
    <TouchableOpacity
      style={styles.recordItem}
      onPress={() => onPress(item.id)}
      activeOpacity={0.8}>
      <View style={[styles.thumbWrap, photoUrl && { backgroundColor: 'transparent' }]}>
        {photoUrl ? (
          <View style={[styles.thumbRotateWrap, { transform: [{ rotate: `${item.photo_rotation ?? 0}deg` }] }]}>
            <Image
              source={{ uri: photoUrl }}
              style={styles.thumbImg}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={item.id}
              onError={(e) => {
                log('[THUMB][ImageError]', { id: item.id, hasUrl: !!item.imageUrl, errorMsg: e?.error?.message ?? null });
              }}
            />
          </View>
        ) : item.photo_uri ? (
          <View style={styles.thumbPlaceholder}>
            <ActivityIndicator size="small" color="#999" />
          </View>
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbPlaceholderText}>写真なし</Text>
          </View>
        )}
      </View>
      <View style={styles.recordContent}>
        <View style={styles.recordFirstRow}>
          <View style={[styles.subjectChip, { backgroundColor: subjectColor }]}>
            <Text style={styles.subjectChipText}>{item.subject}</Text>
          </View>
          <Text style={styles.evaluationText}>{formatEvaluation(item)}</Text>
        </View>
        {item.memo ? (
          <Text style={styles.memoText} numberOfLines={2} ellipsizeMode="tail">
            {item.memo}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default function ListScreen() {
  const router = useRouter();
  const headerTop = useHeaderTop(true);
  const params = useLocalSearchParams();
  const { year, month, setYearMonth } = useDateContext();
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    if (showMonthPicker) setPickerYear(year);
  }, [showMonthPicker, year]);

  const handleMonthChange = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next') {
      if (month === 12) setYearMonth(year + 1, 1);
      else setYearMonth(year, month + 1);
    } else {
      if (month === 1) setYearMonth(year - 1, 12);
      else setYearMonth(year, month - 1);
    }
  }, [year, month, setYearMonth]);

  const handleMonthSelect = useCallback((m: number) => {
    setYearMonth(pickerYear, m);
    setShowMonthPicker(false);
  }, [pickerYear, setYearMonth]);

  const handlePickerYearChange = useCallback((direction: 'next' | 'prev') => {
    setPickerYear((y) => (direction === 'next' ? y + 1 : y - 1));
  }, []);
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [stableSections, setStableSections] = useState<Section[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<'offline' | 'unknown' | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const initialSubject = typeof params.subject === 'string' ? params.subject : null;
  const [activeSubject, setActiveSubject] = useState<string | null>(initialSubject);
  const subjectParam = activeSubject;
  const modeParam = (typeof params.mode === 'string' ? params.mode : 'month') as PeriodMode;
  const initialHalf = (typeof params.half === 'string' ? params.half : 'first') as HalfMode;
  const [activeHalf, setActiveHalf] = useState<HalfMode>(initialHalf);
  const halfParam = activeHalf;
  const initialParamYear = params.year ? parseInt(params.year as string, 10) : NaN;
  const [periodYear, setPeriodYear] = useState<number>(Number.isFinite(initialParamYear) ? initialParamYear : year);
  const effectiveMode: PeriodMode = modeParam;

  useEffect(() => {
    setActiveSubject(initialSubject);
  }, [initialSubject]);

  useEffect(() => {
    const nextHalf = (typeof params.half === 'string' ? params.half : 'first') as HalfMode;
    setActiveHalf(nextHalf);
  }, [params.half]);

  useEffect(() => {
    const nextYear = params.year ? parseInt(params.year as string, 10) : NaN;
    if (Number.isFinite(nextYear)) {
      setPeriodYear(nextYear);
    }
  }, [params.year]);

  const handlePeriodShift = useCallback((direction: 'next' | 'prev') => {
    if (effectiveMode === 'year') {
      setPeriodYear((y) => direction === 'next' ? y + 1 : y - 1);
    } else if (effectiveMode === 'half') {
      if (direction === 'next') {
        if (activeHalf === 'first') {
          setActiveHalf('second');
        } else {
          setPeriodYear((y) => y + 1);
          setActiveHalf('first');
        }
      } else {
        if (activeHalf === 'second') {
          setActiveHalf('first');
        } else {
          setPeriodYear((y) => y - 1);
          setActiveHalf('second');
        }
      }
    }
  }, [effectiveMode, activeHalf]);

  const formatLastUpdated = (d: Date) => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };
  const PAGE_SIZE = 10;
  const activeRequestIdRef = useRef(0);

  const appliedMonthParamRef = useRef('');
  useEffect(() => {
    // month モードで URL パラメータが更新されたときだけ DateContext と同期する。
    // これにより、ヘッダーで月送り中に params によって値が戻されるのを防ぐ。
    if (modeParam !== 'month') return;
    if (!params.year || !params.month) return;
    const key = `${params.year}-${params.month}`;
    if (key === appliedMonthParamRef.current) return;

    const newYear = parseInt(params.year as string, 10);
    const newMonth = parseInt(params.month as string, 10);
    if (!Number.isFinite(newYear) || !Number.isFinite(newMonth)) return;
    if (newMonth < 1 || newMonth > 12) return;

    appliedMonthParamRef.current = key;
    setYearMonth(newYear, newMonth);
  }, [modeParam, params.year, params.month, setYearMonth]);

  const matchesSubjectFilter = useCallback((subject: string, filter: string | null) => {
    if (!filter) return true;
    if (filter === '算数') return subject === '算数' || subject === '数学';
    if (filter === 'その他') return !MAIN_SUBJECTS.includes(subject);
    return subject === filter;
  }, []);

  const getDateRange = useCallback(() => {
    if (effectiveMode === 'year') {
      return {
        startDate: `${periodYear}-04-01`,
        endDate: `${periodYear + 1}-03-31`,
      };
    }

    if (effectiveMode === 'half') {
      if (halfParam === 'first') {
        return {
          startDate: `${periodYear}-04-01`,
          endDate: `${periodYear}-09-30`,
        };
      }
      return {
        startDate: `${periodYear}-10-01`,
        endDate: `${periodYear + 1}-03-31`,
      };
    }

    // month モード: params が DateContext に同期される前は params を直接使う
    const pY = params.year ? parseInt(params.year as string, 10) : NaN;
    const pM = params.month ? parseInt(params.month as string, 10) : NaN;
    const pKey = `${params.year}-${params.month}`;
    const useParams = Number.isFinite(pY) && Number.isFinite(pM) && pKey !== appliedMonthParamRef.current;
    const calendarYear = useParams ? pY : year;
    const calendarMonth = useParams ? pM : month;

    const endDate = new Date(calendarYear, calendarMonth, 0);
    return {
      startDate: `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-01`,
      endDate: `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
    };
  }, [periodYear, params.month, year, month, effectiveMode, halfParam]);

  const flattenSections = useCallback((sectionsData: Section[]): RecordWithImageUrl[] => {
    return sectionsData.flatMap((section) => section.data);
  }, []);

  const groupByDateSections = useCallback((records: RecordWithImageUrl[]): Section[] => {
    const grouped = records.reduce((acc, record) => {
      const dateKey = record.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(record);
      return acc;
    }, {} as Record<string, RecordWithImageUrl[]>);

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({ title: date, data: grouped[date] }));
  }, []);

  const loadRecords = useCallback(async (opts: { isRefresh?: boolean; loadMore?: boolean } = {}) => {
    const requestId = ++activeRequestIdRef.current;
    const isRefresh = opts.isRefresh === true;
    const isLoadMore = opts.loadMore === true;
    if (!selectedChildId || !isFamilyReady || !familyId) {
      if (!isRefresh && !isLoadMore) setIsInitialLoading(false);
      if (isLoadMore) setLoadingMore(false);
      return;
    }

    setLoadError(null);
    if (isRefresh) setRefreshing(true);
    else if (isLoadMore) setLoadingMore(true);
    else setIsInitialLoading(true);

    try {
      const { startDate, endDate } = getDateRange();
      const offset = isLoadMore ? flattenSections(stableSections).length : 0;

      let query = supabase
        .from('records')
        .select('*', { count: 'exact' })
        .eq('child_id', selectedChildId)
        .eq('family_id', familyId)
        .or('score.not.is.null,stamp.not.is.null,photo_uri.not.is.null')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (subjectParam === '算数') {
        query = query.in('subject', ['算数', '数学']);
      } else if (subjectParam === 'その他') {
        query = query.not('subject', 'in', '("国語","算数","数学","理科","社会","英語")');
      } else if (subjectParam) {
        query = query.eq('subject', subjectParam);
      }

      const { data, error, count } = await query
        .range(offset, offset + PAGE_SIZE - 1);

      if (requestId !== activeRequestIdRef.current) return;

      if (error) {
        const isNetwork = isLikelyNetworkError(error);
        logLoadError('記録読み込み');
        warn('[LIST] supabase error:', String(error?.message ?? 'unknown'));
        setLoadError(isNetwork ? 'offline' : 'unknown');
        if (isRefresh) {
          Alert.alert('エラー', isNetwork ? LOAD_ERROR_MESSAGE : UNKNOWN_ERROR_MESSAGE);
        }
        return;
      }

      if (data) {
        setTotalCount(count);
        const filteredData = (data as TestRecord[]).filter((r) => matchesSubjectFilter(r.subject, subjectParam));
        const recordsWithImage: RecordWithImageUrl[] = await Promise.all(
          filteredData.map(async (r) => {
            let imageUrl: string | null = null;
            if (r.photo_uri) {
              const path = /^https?:\/\//.test(r.photo_uri) ? getStoragePathFromUrl(r.photo_uri) : r.photo_uri;
              if (path) {
                try {
                  imageUrl = await getThumbImageUrl(path, 300);
                } catch {
                  imageUrl = null;
                }
              }
            }
            return { ...r, imageUrl };
          })
        );
        log('[LIST][records sample]', recordsWithImage.slice(0, 3).map((r) => ({ id: r.id, photo_uri: r.photo_uri, imageUrl: r.imageUrl ? 'signed' : null })));
        if (isLoadMore) {
          const prev = flattenSections(stableSections);
          const merged = groupByDateSections([...prev, ...recordsWithImage]);
          setSections(merged);
          setStableSections(merged);
        } else {
          const next = groupByDateSections(recordsWithImage);
          setSections(next);
          setStableSections(next);
        }
        setLoadError(null);
        setLastUpdatedAt(new Date());
      }
    } catch (e) {
      if (requestId !== activeRequestIdRef.current) return;
      const isNetwork = isLikelyNetworkError(e);
      logLoadError('記録読み込み');
      warn('[LIST] load exception:', String(e));
      setLoadError(isNetwork ? 'offline' : 'unknown');
      if (isRefresh) {
        Alert.alert('エラー', isNetwork ? LOAD_ERROR_MESSAGE : UNKNOWN_ERROR_MESSAGE);
      }
    } finally {
      if (requestId !== activeRequestIdRef.current) return;
      setHasLoadedOnce(true);
      if (isRefresh) setRefreshing(false);
      else if (isLoadMore) setLoadingMore(false);
      else setIsInitialLoading(false);
    }
  }, [year, month, selectedChildId, isFamilyReady, familyId, subjectParam, matchesSubjectFilter, getDateRange, flattenSections, stableSections, groupByDateSections]);

  const dataKeyRef = useRef('');
  useEffect(() => {
    const key = `${effectiveMode}-${modeParam}-${year}-${month}-${periodYear}-${halfParam}-${selectedChildId}-${familyId}-${subjectParam ?? 'all'}`;
    if (key !== dataKeyRef.current) {
      dataKeyRef.current = key;
      activeRequestIdRef.current += 1;
      setSections([]);
      setStableSections([]);
      setTotalCount(null);
      loadRecords();
    }
  }, [effectiveMode, modeParam, halfParam, periodYear, params.month, year, month, selectedChildId, familyId, subjectParam, loadRecords]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/detail?id=${id}`);
    },
    [router]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const showSpinner =
    !isFamilyReady || (stableSections.length === 0 && (!hasLoadedOnce || isInitialLoading));
  const showEmptyState = isFamilyReady && hasLoadedOnce && !refreshing && stableSections.length === 0 && !loadError;
  const showLoadErrorFullScreen = hasLoadedOnce && loadError && !isInitialLoading && stableSections.length === 0;
  const showBannerAndList = hasLoadedOnce && loadError && !isInitialLoading && stableSections.length > 0;
  const navPeriodLabel = (() => {
    if (effectiveMode === 'year') return `${periodYear}年4月～${periodYear + 1}年3月`;
    if (effectiveMode === 'half') {
      return halfParam === 'first'
        ? `${periodYear}.4～9月`
        : `${periodYear}.10～${periodYear + 1}.3月`;
    }
    return `${year}年 ${month}月`;
  })();
  const emptyPeriodLabel = (() => {
    if (effectiveMode === 'year') {
      return `${periodYear}年4月～${periodYear + 1}年3月`;
    }
    if (effectiveMode === 'half') {
      return halfParam === 'first'
        ? `${periodYear}.4～9月`
        : `${periodYear}.10～${periodYear + 1}.3月`;
    }
    return `${year}年${month}月`;
  })();
  const loadedCount = flattenSections(stableSections).length;
  const hasMore = totalCount !== null && totalCount > loadedCount;
  const remaining = totalCount !== null ? Math.max(totalCount - loadedCount, 0) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={styles.container}>
      <AppHeader
        showYearMonthNav={false}
        safeTopByParent={true}
      />

      <View style={[styles.subNavRow, { top: headerTop }]}>
        <View style={styles.subNavPeriodRow}>
          <TouchableOpacity
            onPress={() => effectiveMode === 'month' ? handleMonthChange('prev') : handlePeriodShift('prev')}
            style={styles.subNavArrowBtn}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color="#4B5563" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.subNavLabelBtn}
            onPress={effectiveMode === 'month' ? () => setShowMonthPicker(true) : undefined}
            activeOpacity={effectiveMode === 'month' ? 0.7 : 1}
          >
            <Text style={styles.subNavPeriodText}>{navPeriodLabel}{effectiveMode === 'month' ? ' ▼' : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => effectiveMode === 'month' ? handleMonthChange('next') : handlePeriodShift('next')}
            style={styles.subNavArrowBtn}
            activeOpacity={0.7}
          >
            <ChevronRight size={18} color="#4B5563" />
          </TouchableOpacity>
        </View>
        {initialSubject ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subNavChips}
            style={styles.subNavChipScroll}
          >
            {SUBJECT_CHIPS.map((s) => {
              const isActive = s === '全体' ? activeSubject === null : activeSubject === s;
              const chipColor = s === '全体' ? '#4A90E2' : getSubjectColor(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.subNavChip,
                    isActive && { backgroundColor: chipColor, borderColor: chipColor },
                  ]}
                  onPress={() => setActiveSubject(s === '全体' ? null : s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subNavChipText, isActive && { color: '#fff' }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthPicker(false)}>
          <TouchableOpacity style={styles.monthPickerContainer} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.monthPickerTitle}>年・月を選択</Text>
            <View style={styles.yearPickerRow}>
              <TouchableOpacity style={styles.yearPickerArrow} onPress={() => handlePickerYearChange('prev')} activeOpacity={0.7}>
                <ChevronLeft size={22} color="#666" />
              </TouchableOpacity>
              <Text style={styles.yearPickerText}>{pickerYear}年</Text>
              <TouchableOpacity style={styles.yearPickerArrow} onPress={() => handlePickerYearChange('next')} activeOpacity={0.7}>
                <ChevronRight size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.monthPickerScroll}>
              <View style={styles.monthPickerGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                  const isActive = pickerYear === year && month === m;
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

      {showBannerAndList ? (
        <View style={styles.mainWithBanner}>
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText} numberOfLines={2}>
              {loadError === 'offline' ? '通信できません' : '読み込みに失敗しました'}
              {lastUpdatedAt ? `（最終更新: ${formatLastUpdated(lastUpdatedAt)}）` : ''}
            </Text>
            <TouchableOpacity
              style={styles.retryButtonSmall}
              onPress={() => loadRecords()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>再試行</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingTop: 12, paddingBottom: 20 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadRecords({ isRefresh: true })}
              />
            }>
            {stableSections.map((section) => (
              <View key={section.title} style={styles.daySection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{formatDate(section.title)}</Text>
                </View>
                <View style={styles.dayRecords}>
                  {section.data.map((item) => (
                    <View key={item.id} style={styles.dayRecordWrapper}>
                      <ListRecordCard item={item} onPress={handlePress} />
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {hasMore ? (
              <TouchableOpacity
                style={styles.showMoreButton}
                onPress={() => loadRecords({ loadMore: true })}
                activeOpacity={0.7}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#4A90E2" />
                ) : (
                  <Text style={styles.showMoreButtonText}>次の{Math.min(PAGE_SIZE, remaining)}件を見る</Text>
                )}
              </TouchableOpacity>
            ) : null}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      ) : null}

      {showSpinner ? (
        <View style={[styles.loadingContainer, { paddingTop: isFamilyReady ? headerTop + SUB_NAV_HEIGHT + 8 : 0 }]}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : showLoadErrorFullScreen ? (
        <View style={[styles.emptyContainer, { paddingTop: headerTop + SUB_NAV_HEIGHT + 8 }]}>
          <Text style={styles.emptyText}>
            {loadError === 'offline' ? LOAD_ERROR_MESSAGE : UNKNOWN_ERROR_MESSAGE}
          </Text>
          {lastUpdatedAt ? (
            <Text style={styles.lastUpdatedText}>最終更新: {formatLastUpdated(lastUpdatedAt)}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadRecords()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : showEmptyState ? (
        <View style={[styles.emptyContainer, { paddingTop: headerTop + SUB_NAV_HEIGHT + 8 }]}>
          <Text style={styles.emptyText}>
            {emptyPeriodLabel}の記録はありません
          </Text>
          <Text style={styles.emptySubText}>登録ボタンから記録を残しましょう</Text>
        </View>
      ) : !showBannerAndList && !showSpinner && !showLoadErrorFullScreen && !showEmptyState ? (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingTop: headerTop + SUB_NAV_HEIGHT + 8 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRecords({ isRefresh: true })}
            />
          }>
          {stableSections.map((section) => (
            <View key={section.title} style={styles.daySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{formatDate(section.title)}</Text>
              </View>
              <View style={styles.dayRecords}>
                {section.data.map((item) => (
                  <View key={item.id} style={styles.dayRecordWrapper}>
                    <ListRecordCard item={item} onPress={handlePress} />
                  </View>
                ))}
              </View>
            </View>
          ))}
          {hasMore ? (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => loadRecords({ loadMore: true })}
              activeOpacity={0.7}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color="#4A90E2" />
              ) : (
                <Text style={styles.showMoreButtonText}>次の{Math.min(PAGE_SIZE, remaining)}件を見る</Text>
              )}
            </TouchableOpacity>
          ) : null}
          <View style={{ height: 20 }} />
        </ScrollView>
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
  listContent: {
    paddingBottom: 20,
  },
  subNavRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 9,
  },
  subNavPeriodRow: {
    height: SUB_NAV_ROW1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  subNavArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subNavLabelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  subNavPeriodText: {
    fontSize: 15,
    color: '#111827',
    fontFamily: 'Nunito-SemiBold',
  },
  subNavChipScroll: {
    height: SUB_NAV_ROW2,
  },
  subNavChips: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  subNavChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  subNavChipText: {
    fontSize: 12,
    color: '#374151',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daySection: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
  },
  sectionHeader: {
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#1e3a8a',
  },
  dayRecords: {
    gap: 2,
  },
  dayRecordWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  recordItem: {
    backgroundColor: '#EEF6FF',
    marginVertical: 2,
    borderRadius: 10,
    flexDirection: 'row-reverse',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
    minHeight: 80,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#eee',
    flexShrink: 0,
    margin: 8,
  },
  thumbRotateWrap: {
    width: '100%',
    height: '100%',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 12,
    opacity: 0.6,
    fontFamily: 'Nunito-SemiBold',
    color: '#999',
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
  memoText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Nunito-Regular',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Nunito-SemiBold',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'Nunito-Regular',
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
  showMoreButton: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showMoreButtonText: {
    color: '#4A90E2',
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
});
