import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Platform } from 'react-native';
import { log, logLoadError } from '@/lib/logger';

const PERIOD_NAV_HEIGHT = 44;
const SUBJECT_ROW_HEIGHT = 40;
const HEADER_EXTRA = PERIOD_NAV_HEIGHT + SUBJECT_ROW_HEIGHT;
const SUBJECT_FILTERS = ['全体', '国語', '算数', '理科', '社会', '英語', 'その他'] as const;
const MAIN_SUBJECTS = ['国語', '算数', '数学', '理科', '社会', '英語'];

const LOAD_ERROR_MESSAGE = '通信できません。接続を確認して再度お試しください';

type RecordWithImageUrl = TestRecord & { imageUrl: string | null };

import { getSubjectColor } from '@/lib/subjects';

const CARD_IMAGE_SIZE = Dimensions.get('window').width - 32;
const CARD_IMAGE_HEIGHT_PHOTO = CARD_IMAGE_SIZE;
const CARD_IMAGE_HEIGHT_NO_PHOTO = 80;

const formatDateMd = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

interface HomeRecordCardProps {
  item: RecordWithImageUrl;
  onPress: (id: string) => void;
  imageError: boolean | undefined;
  onImageError: (id: string, hasError: boolean) => void;
}
const HomeRecordCard = React.memo(function HomeRecordCard({
  item,
  onPress,
  imageError,
  onImageError,
}: HomeRecordCardProps) {
  const [imgHeight, setImgHeight] = useState(CARD_IMAGE_HEIGHT_PHOTO);
  const subjectColor = getSubjectColor(item.subject);
  const hasPhoto = !!(item.imageUrl && isValidImageUri(item.imageUrl));
  const shouldShowPhoto = hasPhoto && !imageError;
  const imageHeight = shouldShowPhoto ? imgHeight : CARD_IMAGE_HEIGHT_NO_PHOTO;
  const hasScore = item.score !== null;
  const maxScore = item.max_score ?? 100;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item.id)}
      activeOpacity={0.8}>
      <View
        style={[
          styles.imageContainer,
          !shouldShowPhoto && styles.imageContainerNoPhoto,
          { width: CARD_IMAGE_SIZE, height: imageHeight },
        ]}>
        {shouldShowPhoto ? (
          <>
            <View style={[styles.imageWrapper, { width: CARD_IMAGE_SIZE, height: imageHeight }]}>
              <Image
                source={item.imageUrl ? { uri: item.imageUrl } : undefined}
                style={styles.cardImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                recyclingKey={item.id}
                onLoad={(e: any) => {
                  onImageError(item.id, false);
                  const w = e?.source?.width;
                  const h = e?.source?.height;
                  if (w && h && w > 0 && h > 0) {
                    const ratio = h / w;
                    const computed = Math.round(CARD_IMAGE_SIZE * ratio);
                    const clamped = Math.min(CARD_IMAGE_HEIGHT_PHOTO, Math.max(200, computed));
                    setImgHeight(clamped);
                  }
                }}
                onError={(e) => {
                  log('[THUMB][ImageError]', { id: item.id, hasUrl: !!item.imageUrl, errorMsg: e?.error?.message ?? null });
                  onImageError(item.id, true);
                }}
              />
            </View>
          </>
        ) : (
          <>
            {item.photo_uri && !item.imageUrl ? (
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : (
              <Text style={styles.noPhotoText}>
                {imageError ? '写真の読み込みに失敗しました' : '写真なし'}
              </Text>
            )}
          </>
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardFirstRow}>
          <View style={[styles.subjectChip, { backgroundColor: subjectColor }]}>
            <Text style={styles.subjectChipText}>{item.subject}</Text>
          </View>
          {hasScore ? (
            <Text style={styles.scoreRow}>
              <Text style={styles.scoreMain}>{item.score}</Text>
              <Text style={styles.scoreSub}> / {maxScore}</Text>
            </Text>
          ) : (
            <Text style={styles.stampText}>{item.stamp || '—'}</Text>
          )}
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

export default function HomeScreen() {
  const debugLog = (...args: unknown[]) => {
    if (__DEV__) {
      log(...args);
    }
  };
  const router = useRouter();
  const headerTop = useHeaderTop(true);
  const [records, setRecords] = useState<RecordWithImageUrl[]>([]);
  const [stableRecords, setStableRecords] = useState<RecordWithImageUrl[]>([]);
  const stableRef = useRef<RecordWithImageUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<'offline' | 'unknown' | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeSubject, setActiveSubject] = useState<string>('全体');
  const canceledRef = useRef(false);
  const listRef = useRef<FlatList<RecordWithImageUrl> | null>(null);
  const prevContextKeyRef = useRef('');
  const prevSubjectRef = useRef(activeSubject);
  const listFadeAnim = useRef(new Animated.Value(1)).current;
  const subjectSwitchingRef = useRef(false);

  const formatLastUpdated = (d: Date) => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  useEffect(() => {
    stableRef.current = stableRecords;
  }, [stableRecords]);
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

  const handleMonthSelect = useCallback((selectedMonth: number) => {
    setYearMonth(pickerYear, selectedMonth);
    setShowMonthPicker(false);
  }, [pickerYear, setYearMonth]);

  const handlePickerYearChange = useCallback((direction: 'next' | 'prev') => {
    setPickerYear((y) => (direction === 'next' ? y + 1 : y - 1));
  }, []);
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();

  const prevMonthKey = useRef(`${year}-${month}-${selectedChildId}`);
  useEffect(() => {
    const key = `${year}-${month}-${selectedChildId}`;
    if (key !== prevMonthKey.current) {
      prevMonthKey.current = key;
      setRecords([]);
      setStableRecords([]);
      setTotalCount(null);
      setHasLoadedOnce(false);
      setLoading(true);
      setLoadError(null);
    }
  }, [year, month, selectedChildId]);

  const PAGE_SIZE = 10;

  const loadRecords = useCallback(async (opts: { isRefresh?: boolean; loadMore?: boolean } = {}) => {
    const isRefresh = opts.isRefresh === true;
    const isLoadMore = opts.loadMore === true;
    if (!selectedChildId || !isFamilyReady || !familyId) {
      if (!canceledRef.current) {
        if (isRefresh) setRefreshing(false);
        else if (!isLoadMore) setLoading(false);
        if (isFamilyReady && familyId) setHasLoadedOnce(true);
      }
      return;
    }

    if (!canceledRef.current) {
      setLoadError(null);
      if (isRefresh) setRefreshing(true);
      else if (isLoadMore) setLoadingMore(true);
      else if (stableRef.current.length === 0) setLoading(true);
    }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const offset = isLoadMore ? stableRef.current.length : 0;

    try {
      let query = supabase
        .from('records')
        .select('*', { count: 'exact' })
        .eq('child_id', selectedChildId)
        .eq('family_id', familyId)
        .or('score.not.is.null,stamp.not.is.null,photo_uri.not.is.null')
        .gte('date', startDate)
        .lte('date', endDateStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (activeSubject === '算数') {
        query = query.in('subject', ['算数', '数学']);
      } else if (activeSubject === 'その他') {
        query = query.not('subject', 'in', '("国語","算数","数学","理科","社会","英語")');
      } else if (activeSubject !== '全体') {
        query = query.eq('subject', activeSubject);
      }

      const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

      if (canceledRef.current) return;
      if (error) {
        const isNetwork = String(error?.message ?? '').includes('Network request failed');
        logLoadError('記録読み込み');
        if (!canceledRef.current) setLoadError(isNetwork ? 'offline' : 'unknown');
        return;
      }

      if (data) {
        setTotalCount(count);
        debugLog(`[記録読み込み] ${data.length}件取得 (offset=${offset}, 全${count}件)`, { platform: Platform.OS });
        const recordsWithImage: RecordWithImageUrl[] = await Promise.all(
          data.map(async (r) => {
            let imageUrl: string | null = null;
            if (r.photo_uri) {
              const path = /^https?:\/\//.test(r.photo_uri) ? getStoragePathFromUrl(r.photo_uri) : r.photo_uri;
              if (path) {
                try {
                  imageUrl = await getThumbImageUrl(path);
                } catch {
                  imageUrl = null;
                }
              }
            }
            return { ...r, imageUrl };
          })
        );
        if (canceledRef.current) return;

        if (isLoadMore) {
          const merged = [...stableRef.current, ...recordsWithImage];
          setRecords(merged);
          setStableRecords(merged);
        } else {
          setRecords(recordsWithImage);
          setStableRecords(recordsWithImage);
          setImageErrors({});
        }
        if (!canceledRef.current) {
          setLoadError(null);
          setLastUpdatedAt(new Date());
        }
      }
    } catch (e) {
      if (!canceledRef.current) {
        const isNetwork = String(e).includes('Network request failed');
        logLoadError('記録読み込み');
        setLoadError(isNetwork ? 'offline' : 'unknown');
      }
    } finally {
      if (!canceledRef.current) {
        if (subjectSwitchingRef.current) {
          Animated.timing(listFadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
          subjectSwitchingRef.current = false;
        }
        setHasLoadedOnce(true);
        if (isRefresh) setRefreshing(false);
        else if (isLoadMore) setLoadingMore(false);
        else setLoading(false);
      }
    }
  }, [year, month, selectedChildId, isFamilyReady, familyId, activeSubject]);

  const dataKeyRef = useRef('');
  useEffect(() => {
    const key = `${year}-${month}-${selectedChildId}-${familyId}-${activeSubject}`;
    const contextKey = `${year}-${month}-${selectedChildId}-${familyId}`;
    const onlySubjectChanged =
      prevContextKeyRef.current === contextKey && prevSubjectRef.current !== activeSubject;

    if (key !== dataKeyRef.current) {
      dataKeyRef.current = key;
      canceledRef.current = false;
      if (onlySubjectChanged) {
        subjectSwitchingRef.current = true;
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        listFadeAnim.stopAnimation();
        Animated.timing(listFadeAnim, { toValue: 0.72, duration: 220, useNativeDriver: true }).start(() => {
          loadRecords();
        });
      } else {
        loadRecords();
      }
    }
    prevContextKeyRef.current = contextKey;
    prevSubjectRef.current = activeSubject;
    return () => { canceledRef.current = true; };
  }, [year, month, selectedChildId, familyId, activeSubject, loadRecords]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/detail?id=${id}`);
    },
    [router]
  );

  const handleImageError = useCallback((id: string, hasError: boolean) => {
    setImageErrors((prev) => {
      if (hasError) return { ...prev, [id]: true };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: RecordWithImageUrl; index: number }) => {
      const prev = index > 0 ? stableRecords[index - 1] : null;
      const showDateHeader = !prev || prev.date !== item.date;
      return (
        <View style={styles.cardGroup}>
          {showDateHeader ? (
            <Text style={styles.dateHeaderText}>{formatDateMd(item.date)}</Text>
          ) : null}
          <HomeRecordCard
            item={item}
            onPress={handlePress}
            imageError={imageErrors[item.id]}
            onImageError={handleImageError}
          />
        </View>
      );
    },
    [stableRecords, handlePress, imageErrors, handleImageError]
  );

  const keyExtractor = useCallback((item: RecordWithImageUrl) => item.id, []);

  const hasMore = totalCount !== null && totalCount > stableRecords.length;
  const remaining = totalCount !== null ? totalCount - stableRecords.length : 0;
  const listFooter = useCallback(() => {
    if (!hasMore) return null;
    if (loadingMore) {
      return (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator size="small" color="#4A90E2" />
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.showAllButton}
        onPress={() => loadRecords({ loadMore: true })}
        activeOpacity={0.7}
      >
        <Text style={styles.showAllButtonText}>
          次の{Math.min(remaining, PAGE_SIZE)}件を見る
        </Text>
      </TouchableOpacity>
    );
  }, [hasMore, remaining, loadingMore, loadRecords]);

  if (!isFamilyReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const showSpinner = !hasLoadedOnce && loading && stableRecords.length === 0;
  const showEmptyState = hasLoadedOnce && !loading && !refreshing && stableRecords.length === 0 && !loadError;
  const showLoadErrorFullScreen = hasLoadedOnce && loadError && !loading && stableRecords.length === 0;
  const showBannerAndList = hasLoadedOnce && loadError && !loading && stableRecords.length > 0;
  const showList = !showBannerAndList && !showSpinner && !showLoadErrorFullScreen && stableRecords.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={styles.container}>
      <AppHeader showYearMonthNav={false} safeTopByParent={true} />

      <View style={[styles.headerExtraWrap, { top: headerTop }]}>
        <View style={styles.periodNavRow}>
          <TouchableOpacity style={styles.periodArrowBtn} onPress={() => handleMonthChange('prev')} activeOpacity={0.7}>
            <ChevronLeft size={18} color="#4B5563" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.periodLabelBtn} onPress={() => setShowMonthPicker(true)} activeOpacity={0.7}>
            <Text style={styles.periodLabelText}>{year}年 {month}月 ▼</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.periodArrowBtn} onPress={() => handleMonthChange('next')} activeOpacity={0.7}>
            <ChevronRight size={18} color="#4B5563" />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
          style={styles.filterChipScroll}
        >
          {SUBJECT_FILTERS.map((s) => {
            const isActive = activeSubject === s;
            const chipColor = s === '全体' ? '#4A90E2' : getSubjectColor(s);
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: chipColor, borderColor: chipColor },
                ]}
                onPress={() => setActiveSubject(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && { color: '#fff' }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.monthPickerItem,
                      pickerYear === year && month === m && styles.monthPickerItemSelected,
                    ]}
                    onPress={() => handleMonthSelect(m)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.monthPickerItemText,
                        pickerYear === year && month === m && styles.monthPickerItemTextSelected,
                      ]}>
                      {m}月
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {showBannerAndList ? (
        <View style={styles.mainWithBanner}>
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText} numberOfLines={2}>
              通信できません{lastUpdatedAt ? `（最終更新: ${formatLastUpdated(lastUpdatedAt)}）` : ''}
            </Text>
            <TouchableOpacity
              style={styles.retryButtonSmall}
              onPress={() => loadRecords()}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>再試行</Text>
            </TouchableOpacity>
          </View>
          <Animated.View style={{ flex: 1, opacity: listFadeAnim }}>
            <FlatList
              ref={listRef}
              data={stableRecords}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              removeClippedSubviews={false}
              windowSize={5}
              initialNumToRender={10}
              contentContainerStyle={[styles.listContent, { paddingTop: headerTop + HEADER_EXTRA + 8, paddingBottom: 24 }]}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={listFooter}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadRecords({ isRefresh: true })}
                />
              }
            />
          </Animated.View>
        </View>
      ) : null}

      {showSpinner ? (
        <View style={[styles.loadingContainer, { paddingTop: headerTop + HEADER_EXTRA + 8 }]}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : showLoadErrorFullScreen ? (
        <View style={[styles.emptyContainer, { paddingTop: headerTop + HEADER_EXTRA + 8 }]}>
          <Text style={styles.emptyText}>{LOAD_ERROR_MESSAGE}</Text>
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
        <View style={[styles.emptyContainer, { paddingTop: headerTop + HEADER_EXTRA + 8 }]}>
          <Text style={styles.emptyText}>{year}年{month}月の記録はありません</Text>
          <Text style={styles.emptySubText}>登録ボタンから記録を残しましょう</Text>
        </View>
      ) : showList ? (
        <Animated.View style={{ flex: 1, opacity: listFadeAnim }}>
          <FlatList
            ref={listRef}
            data={stableRecords}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            removeClippedSubviews={false}
            windowSize={5}
            initialNumToRender={10}
            contentContainerStyle={[styles.listContent, { paddingTop: headerTop + HEADER_EXTRA + 8 }]}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={listFooter}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadRecords({ isRefresh: true })}
              />
            }
          />
        </Animated.View>
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
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainerNoPhoto: {
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderStyle: 'dashed',
  },
  noPhotoText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Nunito-Regular',
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGroup: {
    gap: 6,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Nunito-Regular',
    marginLeft: 2,
  },
  cardContent: {
    padding: 16,
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
  scoreRow: {
    marginLeft: 12,
  },
  scoreMain: {
    fontSize: 17,
    color: '#000',
    fontFamily: 'Nunito-Bold',
  },
  scoreSub: {
    fontSize: 12,
    color: '#A3A3A3',
    fontFamily: 'Nunito-Regular',
  },
  stampText: {
    marginLeft: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Nunito-Regular',
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
  lastUpdatedText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    fontFamily: 'Nunito-Regular',
  },
  emptySubText: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'Nunito-Regular',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showAllButton: {
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
    alignItems: 'center',
  },
  showAllButtonText: {
    fontSize: 15,
    color: '#4A90E2',
    fontFamily: 'Nunito-SemiBold',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerExtraWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 9,
  },
  periodNavRow: {
    height: PERIOD_NAV_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterChipScroll: {
    height: SUBJECT_ROW_HEIGHT,
  },
  filterChipRow: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
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
    color: '#6B7280',
    fontFamily: 'Nunito-SemiBold',
  },
  periodArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  periodLabelText: {
    fontSize: 15,
    color: '#111827',
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
