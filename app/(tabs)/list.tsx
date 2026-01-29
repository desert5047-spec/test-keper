import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { isValidImageUri } from '@/utils/imageGuard';
import { AppHeader, HEADER_HEIGHT } from '@/components/AppHeader';
import { colors, textStyles } from '@/theme/uiTokens';

interface Section {
  title: string;
  data: TestRecord[];
}

export default function ListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { year, month, setYearMonth } = useDateContext();
  const { selectedChildId } = useChild();
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (params.year && params.month) {
      const newYear = parseInt(params.year as string);
      const newMonth = parseInt(params.month as string);
      setYearMonth(newYear, newMonth);
    }
  }, [params]);

  useFocusEffect(
    useCallback(() => {
      if (selectedChildId) {
        loadRecords();
      }
    }, [year, month, selectedChildId])
  );

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
    } else {
      setSections([]);
    }
  };

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

  const renderSection = ({ item: section }: { item: Section }) => {
    return (
      <View style={styles.dateCard}>
        <View style={styles.dateCardHeader}>
          <Text style={styles.sectionHeaderText}>{formatDate(section.title)}</Text>
        </View>
        <View style={styles.dateCardContent}>
          {section.data.map((record) => (
            <TouchableOpacity
              key={record.id}
              style={styles.recordItem}
              onPress={() => router.push(`/detail?id=${record.id}`)}
              activeOpacity={0.8}>
              <View style={styles.recordContent}>
                <View style={styles.recordFirstRow}>
                  <View style={[styles.subjectChip, { backgroundColor: getSubjectColor(record.subject) }]}>
                    <Text style={styles.subjectChipText}>{record.subject}</Text>
                  </View>
                  {record.score !== null ? (
                    <Text style={styles.evaluationText}>
                      <Text style={styles.scoreText}>{record.score}点</Text>
                      <Text>（{record.max_score}点中）</Text>
                    </Text>
                  ) : (
                    <Text style={styles.evaluationText}>{record.stamp || ''}</Text>
                  )}
                </View>
              </View>
              <View style={styles.thumbnailContainer}>
                {record.photo_uri && isValidImageUri(record.photo_uri) ? (
                  <View
                    style={[
                      styles.thumbnailWrapper,
                      {
                        transform: [{ rotate: `${record.photo_rotation}deg` }],
                      },
                    ]}>
                    <Image
                      source={{ uri: record.photo_uri }}
                      style={styles.thumbnail}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.placeholderThumbnail} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {sections.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>
            {year}年{month}月の記録はありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          renderItem={renderSection}
          keyExtractor={(section) => section.title}
          contentContainerStyle={[styles.listContent, { paddingTop: HEADER_HEIGHT + 12 }]}
          showsVerticalScrollIndicator={false}
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
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  dateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  dateCardHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionHeaderText: {
    ...textStyles.heading,
    fontSize: 16,
    fontFamily: 'Nunito-Medium',
    fontWeight: 500,
    color: colors.blue900,
  },
  dateCardContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  recordItem: {
    backgroundColor: '#EEF6FF',
    marginVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
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
    fontFamily: 'Nunito-Medium',
    fontWeight: 500,
    lineHeight: 14,
  },
  evaluationText: {
    fontSize: 15,
    color: '#333',
    fontFamily: 'Nunito-Medium',
    fontWeight: 500,
    marginLeft: 10,
    lineHeight: 18,
  },
  scoreText: {
    fontSize: 15,
    color: colors.blue600,
    fontFamily: 'Nunito-Medium',
    fontWeight: 500,
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
