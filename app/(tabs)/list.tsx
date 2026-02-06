import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { useAuth } from '@/contexts/AuthContext';
import { isValidImageUri } from '@/utils/imageGuard';
import { getSignedImageUrl } from '@/utils/imageUpload';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';

interface Section {
  title: string;
  data: TestRecord[];
}

export default function ListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { year, month, setYearMonth } = useDateContext();
  const { selectedChildId } = useChild();
  const { familyId, isFamilyReady } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [resolvedImageUrls, setResolvedImageUrls] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (params.year && params.month) {
      const newYear = parseInt(params.year as string);
      const newMonth = parseInt(params.month as string);
      setYearMonth(newYear, newMonth);
    }
  }, [params]);

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId && isFamilyReady && familyId) {
        loadRecords();
      }
    }, [year, month, selectedChildId, isFamilyReady, familyId])
  );

  const loadRecords = async () => {
    if (!selectedChildId || !isFamilyReady || !familyId) return;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('records')
      .select('*')
      .eq('child_id', selectedChildId)
      .eq('family_id', familyId)
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      const grouped = data.reduce((acc, record) => {
        const dateKey = record.date;
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(record);
        return acc;
      }, {} as Record<string, TestRecord[]>);

      const sectionsData: Section[] = Object.keys(grouped)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({
          title: date,
          data: grouped[date],
        }));

      setSections(sectionsData);
      setResolvedImageUrls({});
    } else {
      setSections([]);
      setResolvedImageUrls({});
    }
  };

  useEffect(() => {
    const loadResolvedImageUrls = async () => {
      const allRecords = sections.flatMap((section) => section.data);
      const targets = allRecords.filter((record) => record.photo_uri && !resolvedImageUrls[record.id]);
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

    if (sections.length > 0) {
      loadResolvedImageUrls();
    }
  }, [sections, resolvedImageUrls]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
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

  const renderItem = (item: TestRecord) => {
    const subjectColor = getSubjectColor(item.subject);
    const resolvedUrl = resolvedImageUrls[item.id];
    const hasPhoto = !!resolvedUrl && isValidImageUri(resolvedUrl);

    if (item.photo_uri && resolvedUrl && !isValidImageUri(resolvedUrl)) {
      console.warn('[画像警告] 無効な画像URIが検出されました');
    }

    return (
      <TouchableOpacity
        style={styles.recordItem}
        onPress={() => router.push(`/detail?id=${item.id}`)}
        activeOpacity={0.8}>
        <View style={styles.thumbnailContainer}>
          {hasPhoto ? (
            <View
              style={[
                styles.thumbnailWrapper,
                {
                  transform: [{ rotate: `${item.photo_rotation}deg` }],
                },
              ]}>
              <Image
                source={{ uri: resolvedUrl! }}
                style={styles.thumbnail}
                resizeMode="contain"
              />
            </View>
          ) : item.photo_uri ? (
            <ActivityIndicator size="small" color="#999" />
          ) : (
            <View style={styles.placeholderThumbnail}>
              <Text style={styles.placeholderText}>なし</Text>
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
  };

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {!isFamilyReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : sections.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>
            {year}年{month}月の記録はありません
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingTop: HEADER_HEIGHT + 12 }]}
          showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section.title} style={styles.daySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{formatDate(section.title)}</Text>
              </View>
              <View style={styles.dayRecords}>
                {section.data.map((item) => (
                  <View key={item.id} style={styles.dayRecordWrapper}>
                    {renderItem(item)}
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
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  thumbnailWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
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
