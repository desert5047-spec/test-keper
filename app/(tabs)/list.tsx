import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

interface Section {
  title: string;
  data: RecordWithImageUrl[];
}

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
      <View style={styles.thumbWrap}>
        {photoUrl ? (
          <View style={[styles.thumbRotateWrap, { transform: [{ rotate: `${item.photo_rotation ?? 0}deg` }] }]}>
            <Image
              source={{ uri: photoUrl }}
              style={styles.thumbImg}
              contentFit="cover"
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
      </View>
    </TouchableOpacity>
  );
});

export default function ListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { year, month, setYearMonth } = useDateContext();
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [stableSections, setStableSections] = useState<Section[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.year && params.month) {
      const newYear = parseInt(params.year as string);
      const newMonth = parseInt(params.month as string);
      setYearMonth(newYear, newMonth);
    }
  }, [params, setYearMonth]);

  const loadRecords = useCallback(async (opts: { isRefresh?: boolean } = {}) => {
    const isRefresh = opts.isRefresh === true;
    if (!selectedChildId || !isFamilyReady || !familyId) {
      if (!isRefresh) setIsInitialLoading(false);
      return;
    }

    if (!isRefresh) setIsInitialLoading(true);
    else setRefreshing(true);

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0);
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

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
        logError('[記録読み込みエラー]', error.message);
        if (isRefresh) {
          Alert.alert('エラー', '一覧の取得に失敗しました。しばらくしてからお試しください。');
        }
        return;
      }

      if (data) {
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
        log('[LIST][records sample]', recordsWithImage.slice(0, 3).map((r) => ({ id: r.id, photo_uri: r.photo_uri, imageUrl: r.imageUrl ? 'signed' : null })));
        const grouped = recordsWithImage.reduce((acc, record) => {
          const dateKey = record.date;
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(record);
          return acc;
        }, {} as Record<string, RecordWithImageUrl[]>);

        const sectionsData: Section[] = Object.keys(grouped)
          .sort((a, b) => b.localeCompare(a))
          .map((date) => ({ title: date, data: grouped[date] }));
        setSections(sectionsData);
        setStableSections(sectionsData);
      }
    } catch (e) {
      logError('[記録読み込みエラー]', e);
      if (isRefresh) {
        Alert.alert('エラー', '一覧の取得に失敗しました。しばらくしてからお試しください。');
      }
    } finally {
      setHasLoadedOnce(true);
      if (isRefresh) setRefreshing(false);
      else setIsInitialLoading(false);
    }
  }, [year, month, selectedChildId, isFamilyReady, familyId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

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
  const showEmptyState = isFamilyReady && hasLoadedOnce && !refreshing && stableSections.length === 0;

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {showSpinner ? (
        <View style={[styles.loadingContainer, { paddingTop: isFamilyReady ? HEADER_HEIGHT : 0 }]}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : showEmptyState ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>
            {year}年{month}月の記録はありません
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingTop: HEADER_HEIGHT + 12 }]}
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
  listContent: {
    paddingBottom: 20,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
  },
});
