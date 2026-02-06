import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { isValidImageUri } from '@/utils/imageGuard';
import { getSignedImageUrl } from '@/utils/imageUpload';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';

export default function HomeScreen() {
  const debugLog = (...args: unknown[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  };
  const router = useRouter();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [imageAspectRatios, setImageAspectRatios] = useState<{ [key: string]: number }>({});
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [resolvedImageUrls, setResolvedImageUrls] = useState<{ [key: string]: string }>({});
  const { year, month } = useDateContext();
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId && isFamilyReady && familyId) {
        loadRecords();
      }
    }, [year, month, selectedChildId, isFamilyReady, familyId])
  );

  useEffect(() => {
    const loadResolvedImageUrls = async () => {
      const targets = records.filter((record) => record.photo_uri && !resolvedImageUrls[record.id]);
      if (targets.length === 0) return;

      const entries = await Promise.all(
        targets.map(async (record) => {
          const resolved = await getSignedImageUrl(record.photo_uri);
          return [record.id, resolved];
        })
      );

      const nextMap: { [key: string]: string } = {};
      entries.forEach(([id, url]) => {
        if (typeof id === 'string' && url) {
          nextMap[id] = url;
        }
      });
      if (Object.keys(nextMap).length > 0) {
        setResolvedImageUrls((prev) => ({ ...prev, ...nextMap }));
      }
    };

    if (records.length > 0) {
      loadResolvedImageUrls();
    }
  }, [records, resolvedImageUrls]);

  // 画像のアスペクト比を事前に取得
  useEffect(() => {
    const loadImageAspectRatios = async () => {
      const newAspectRatios: { [key: string]: number } = {};
      const recordsToLoad = records.filter(
        (record) => resolvedImageUrls[record.id] && !imageAspectRatios[record.id]
      );

      if (recordsToLoad.length === 0) return;

      debugLog(`[画像アスペクト比] ${recordsToLoad.length}件の画像サイズを取得中...`);

      // 並列で画像サイズを取得
      const promises = recordsToLoad.map((record) => {
        return new Promise<void>((resolve) => {
          Image.getSize(
            resolvedImageUrls[record.id]!,
            (width, height) => {
              if (width && height) {
                const aspectRatio = width / height;
                newAspectRatios[record.id] = aspectRatio;
                debugLog(`[画像アスペクト比] ${record.id}: ${width}x${height} = ${aspectRatio.toFixed(2)}`);
              }
              resolve();
            },
            () => {
              console.error('[画像サイズ取得エラー]');
              // エラーを記録
              setImageErrors((prev) => ({ ...prev, [record.id]: true }));
              resolve();
            }
          );
        });
      });

      await Promise.all(promises);

      if (Object.keys(newAspectRatios).length > 0) {
        debugLog(`[画像アスペクト比] ${Object.keys(newAspectRatios).length}件のアスペクト比を更新`);
        setImageAspectRatios((prev) => ({
          ...prev,
          ...newAspectRatios,
        }));
      }
    };

    if (records.length > 0) {
      loadImageAspectRatios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, resolvedImageUrls, imageAspectRatios]);

  const loadRecords = async () => {
    if (!selectedChildId || !isFamilyReady || !familyId) return;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('records')
      .select('*')
      .eq('child_id', selectedChildId)
      .eq('family_id', familyId)
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[記録読み込みエラー]');
      return;
    }

    if (data) {
      debugLog(`[記録読み込み] ${data.length}件の記録を取得`, { platform: Platform.OS });
      setRecords(data);
      // エラー状態をリセット
      setImageErrors({});
      setResolvedImageUrls({});
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatEvaluation = (record: TestRecord) => {
    if (record.score !== null) {
      return `${record.score}点（${record.max_score}点中）`;
    }
    return record.stamp || '';
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

  const renderRecord = ({ item }: { item: TestRecord }) => {
    const resolvedUrl = resolvedImageUrls[item.id];
    const hasPhoto = !!resolvedUrl && isValidImageUri(resolvedUrl);
    const isResolvingPhoto = !!item.photo_uri && !resolvedUrl;
    const subjectColor = getSubjectColor(item.subject);
    const hasImageError = imageErrors[item.id];

    if (item.photo_uri && resolvedUrl && !isValidImageUri(resolvedUrl)) {
      console.warn('[画像警告] 無効な画像URIが検出されました');
    }

    // 画像エラーがある場合は写真なしとして扱う
    const shouldShowPhoto = hasPhoto && !hasImageError;

    // 横幅に合わせて高さを統一（カード幅と同じ高さ）
    const getImageContainerHeight = () => {
      const screenWidth = Dimensions.get('window').width;
      const cardWidth = screenWidth - 32; // 左右のパディング16px × 2
      return cardWidth;
    };
    const imageContainerHeight = shouldShowPhoto ? getImageContainerHeight() : 160;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/detail?id=${item.id}`)}
        activeOpacity={0.8}>
        <View style={[
          styles.imageContainer, 
          !shouldShowPhoto && styles.imageContainerNoPhoto,
          { height: imageContainerHeight }
        ]}>
          {shouldShowPhoto ? (
            <>
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: resolvedUrl! }}
                  style={styles.cardImage}
                  resizeMode="contain"
                  onLoad={() => {
                    debugLog(`[画像読み込み成功] ${item.id}`);
                    // エラー状態をクリア
                    if (imageErrors[item.id]) {
                      setImageErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors[item.id];
                        return newErrors;
                      });
                    }
                  }}
                  onError={() => {
                    console.warn('[画像読み込みエラー]');
                    // エラーを記録
                    setImageErrors((prev) => ({ ...prev, [item.id]: true }));
                  }}
                />
              </View>
              <View style={styles.dateOverlay}>
                <Text style={styles.dateOverlayText}>{formatDate(item.date)}</Text>
              </View>
            </>
          ) : (
            <>
              {isResolvingPhoto ? (
                <ActivityIndicator size="small" color="#4A90E2" />
              ) : (
                <Text style={styles.noPhotoText}>
                  {hasImageError ? '写真の読み込みに失敗しました' : '写真なし'}
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
  };

  if (!isFamilyReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {records.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>まだ記録がありません</Text>
          <Text style={styles.emptySubText}>登録ボタンから記録を残しましょう</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingTop: HEADER_HEIGHT + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
    height: 240,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainerNoPhoto: {
    height: 80,
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
    width: '100%',
    height: '100%',
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
