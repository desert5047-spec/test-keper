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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { isValidImageUri } from '@/utils/imageGuard';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [imageAspectRatios, setImageAspectRatios] = useState<{ [key: string]: number }>({});
  const { year, month } = useDateContext();
  const { selectedChildId } = useChild();

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId) {
        loadRecords();
      }
    }, [year, month, selectedChildId])
  );

  // 画像のアスペクト比を事前に取得
  useEffect(() => {
    const loadImageAspectRatios = async () => {
      const newAspectRatios: { [key: string]: number } = {};
      const recordsToLoad = records.filter(
        (record) => record.photo_uri && isValidImageUri(record.photo_uri) && !imageAspectRatios[record.id]
      );

      if (recordsToLoad.length === 0) return;

      console.log(`[画像アスペクト比] ${recordsToLoad.length}件の画像サイズを取得中...`);

      // 並列で画像サイズを取得
      const promises = recordsToLoad.map((record) => {
        return new Promise<void>((resolve) => {
          Image.getSize(
            record.photo_uri!,
            (width, height) => {
              if (width && height) {
                const aspectRatio = width / height;
                newAspectRatios[record.id] = aspectRatio;
                console.log(`[画像アスペクト比] ${record.id}: ${width}x${height} = ${aspectRatio.toFixed(2)}`);
              }
              resolve();
            },
            (error) => {
              console.warn(`[画像サイズ取得エラー] ${record.id}:`, error);
              resolve();
            }
          );
        });
      });

      await Promise.all(promises);

      if (Object.keys(newAspectRatios).length > 0) {
        console.log(`[画像アスペクト比] ${Object.keys(newAspectRatios).length}件のアスペクト比を更新`);
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
  }, [records]);

  const loadRecords = async () => {
    if (!selectedChildId) return;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('child_id', selectedChildId)
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setRecords(data);
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
    const hasPhoto = !!item.photo_uri && isValidImageUri(item.photo_uri);
    const subjectColor = getSubjectColor(item.subject);
    const imageAspectRatio = imageAspectRatios[item.id];

    if (item.photo_uri && !isValidImageUri(item.photo_uri)) {
      console.warn('[画像警告] 無効な画像URIが検出されました:', item.photo_uri);
    }

    // コンテナの高さは元のアスペクト比で計算（回転は画像の表示にのみ影響）
    // 詳細画面と同じ表示にするため、回転を考慮しない
    const isLandscape = imageAspectRatio ? imageAspectRatio > 1 : null;

    // アスペクト比に応じてコンテナの高さを動的に計算
    const getImageContainerHeight = () => {
      if (!hasPhoto) return 80;
      if (!imageAspectRatio) {
        // アスペクト比が取得できていない場合はデフォルト
        return 240;
      }
      
      // 実際の画面幅を取得（カードの幅 = 画面幅 - パディング32px）
      const screenWidth = Dimensions.get('window').width;
      const cardWidth = screenWidth - 32; // 左右のパディング16px × 2
      
      // 元のアスペクト比に基づいて高さを計算（回転を考慮しない）
      // 横長の画像: 高さを小さく
      // 縦長の画像: 高さを大きく
      const calculatedHeight = cardWidth / imageAspectRatio;
      
      // 高さの範囲を制限
      // 横長の画像（imageAspectRatio > 1）: 最小150px、最大300px
      // 縦長の画像（imageAspectRatio <= 1）: 最小200px、最大500px
      const height = imageAspectRatio > 1
        ? Math.max(150, Math.min(300, calculatedHeight))
        : Math.max(200, Math.min(500, calculatedHeight));
      
      console.log(`[画像コンテナ高さ] ${item.id}: アスペクト比=${imageAspectRatio.toFixed(2)}, 横長=${isLandscape}, 回転=${item.photo_rotation || 0}度, 計算高さ=${calculatedHeight.toFixed(0)}px, 最終高さ=${height}px`);
      return height;
    };

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/detail?id=${item.id}`)}
        activeOpacity={0.8}>
        <View style={[
          styles.imageContainer, 
          !hasPhoto && styles.imageContainerNoPhoto,
          { height: getImageContainerHeight() }
        ]}>
          {hasPhoto ? (
            <>
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: item.photo_uri! }}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.dateOverlay}>
                <Text style={styles.dateOverlayText}>{formatDate(item.date)}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.noPhotoText}>写真なし</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
});
