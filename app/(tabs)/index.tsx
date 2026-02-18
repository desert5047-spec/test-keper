import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { isValidImageUri } from '@/utils/imageGuard';
import { getSignedImageUrl } from '@/lib/storage';
import { getStoragePathFromUrl } from '@/utils/imageUpload';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';
import { log, error as logError } from '@/lib/logger';

type RecordWithImageUrl = TestRecord & { imageUrl: string | null };

const SUBJECT_COLORS: { [key: string]: string } = {
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
const getSubjectColor = (subject: string) => SUBJECT_COLORS[subject] || '#95A5A6';

const CARD_IMAGE_SIZE = Dimensions.get('window').width - 32;
const CARD_IMAGE_HEIGHT_PHOTO = CARD_IMAGE_SIZE;
const CARD_IMAGE_HEIGHT_NO_PHOTO = 160;

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
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const formatEvaluation = (r: TestRecord) =>
    r.score !== null ? `${r.score}点（${r.max_score}点中）` : (r.stamp || '');
  const subjectColor = getSubjectColor(item.subject);
  const hasPhoto = !!(item.imageUrl && isValidImageUri(item.imageUrl));
  const shouldShowPhoto = hasPhoto && !imageError;
  const imageHeight = shouldShowPhoto ? CARD_IMAGE_HEIGHT_PHOTO : CARD_IMAGE_HEIGHT_NO_PHOTO;

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
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
                recyclingKey={item.id}
                onLoad={() => onImageError(item.id, false)}
                onError={(e) => {
                  log('[THUMB][ImageError]', { id: item.id, hasUrl: !!item.imageUrl, errorMsg: e?.error?.message ?? null });
                  onImageError(item.id, true);
                }}
              />
              {__DEV__ && (
                <Text numberOfLines={1} style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                  {item.imageUrl ? 'signed' : 'imageUrl:null'}
                </Text>
              )}
            </View>
            <View style={styles.dateOverlay}>
              <Text style={styles.dateOverlayText}>{formatDate(item.date)}</Text>
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
            <View style={styles.dateOverlay}>
              <Text style={styles.dateOverlayText}>{formatDate(item.date)}</Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardFirstRow}>
          <View style={[styles.subjectChip, { backgroundColor: subjectColor }]}>
            <Text style={styles.subjectChipText}>{item.subject}</Text>
          </View>
          <Text style={styles.evaluationText}>{formatEvaluation(item)}</Text>
        </View>
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
  const [records, setRecords] = useState<RecordWithImageUrl[]>([]);
  const [stableRecords, setStableRecords] = useState<RecordWithImageUrl[]>([]);
  const stableRef = useRef<RecordWithImageUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const canceledRef = useRef(false);

  useEffect(() => {
    stableRef.current = stableRecords;
  }, [stableRecords]);
  const { year, month } = useDateContext();
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();

  const loadRecords = useCallback(async (opts: { isRefresh?: boolean } = {}) => {
    const isRefresh = opts.isRefresh === true;
    if (!selectedChildId || !isFamilyReady || !familyId) {
      if (!canceledRef.current) {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
      return;
    }

    if (!canceledRef.current) {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
    }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    try {
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

      if (canceledRef.current) return;
      if (error) {
        logError('[記録読み込みエラー]');
        return;
      }

      if (data) {
        debugLog(`[記録読み込み] ${data.length}件の記録を取得`, { platform: Platform.OS });
        const recordsWithImage: RecordWithImageUrl[] = await Promise.all(
          data.map(async (r) => {
            let imageUrl: string | null = null;
            if (r.photo_uri) {
              const path = /^https?:\/\//.test(r.photo_uri) ? getStoragePathFromUrl(r.photo_uri) : r.photo_uri;
              if (path) {
                try {
                  imageUrl = await getSignedImageUrl(path);
                } catch {
                  imageUrl = null;
                }
              }
            }
            return { ...r, imageUrl };
          })
        );
        if (canceledRef.current) return;
        log('[HOME][records sample]', recordsWithImage.slice(0, 3).map((r) => ({ id: r.id, photo_uri: r.photo_uri, imageUrl: r.imageUrl ? 'signed' : null })));
        const newRows = recordsWithImage;
        setRecords(newRows);
        setStableRecords(newRows);
        setImageErrors({});
      }
    } catch (e) {
      if (!canceledRef.current) logError('[記録読み込みエラー]', e);
    } finally {
      if (!canceledRef.current) {
        setHasLoadedOnce(true);
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    }
  }, [year, month, selectedChildId, isFamilyReady, familyId]);

  useFocusEffect(
    useCallback(() => {
      canceledRef.current = false;
      loadRecords();
      return () => {
        canceledRef.current = true;
      };
    }, [loadRecords])
  );

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

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
    ({ item }: { item: RecordWithImageUrl }) => (
      <HomeRecordCard
        item={item}
        onPress={handlePress}
        imageError={imageErrors[item.id]}
        onImageError={handleImageError}
      />
    ),
    [handlePress, handleImageError]
  );

  const keyExtractor = useCallback((item: RecordWithImageUrl) => item.id, []);

  if (!isFamilyReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const showSpinner = !hasLoadedOnce && loading && stableRecords.length === 0;
  const showEmptyState = hasLoadedOnce && !loading && !refreshing && stableRecords.length === 0;

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {showSpinner ? (
        <View style={[styles.loadingContainer, { paddingTop: HEADER_HEIGHT }]}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : showEmptyState ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>まだ記録がありません</Text>
          <Text style={styles.emptySubText}>登録ボタンから記録を残しましょう</Text>
        </View>
      ) : (
        <FlatList
          data={stableRecords}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          removeClippedSubviews={false}
          windowSize={5}
          initialNumToRender={10}
          contentContainerStyle={[styles.listContent, { paddingTop: HEADER_HEIGHT + 16 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            refreshing ? null : (
              <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
                <Text style={styles.emptyText}>まだ記録がありません</Text>
                <Text style={styles.emptySubText}>登録ボタンから記録を残しましょう</Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRecords({ isRefresh: true })}
            />
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
    backgroundColor: '#eee',
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
  evaluationText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Nunito-Bold',
    marginLeft: 12,
    lineHeight: 20,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
