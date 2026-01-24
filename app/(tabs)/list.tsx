import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { TestRecord } from '@/types/database';
import { useDateContext } from '@/contexts/DateContext';
import { useChild } from '@/contexts/ChildContext';
import { isValidImageUri } from '@/utils/imageGuard';
import { AppHeader } from '@/components/AppHeader';

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

  const renderItem = ({ item }: { item: TestRecord }) => {
    const subjectColor = getSubjectColor(item.subject);
    const hasPhoto = !!item.photo_uri && isValidImageUri(item.photo_uri);

    if (item.photo_uri && !isValidImageUri(item.photo_uri)) {
      console.warn('[画像警告] 無効な画像URIが検出されました:', item.photo_uri);
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
                source={{ uri: item.photo_uri! }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.placeholderThumbnail} />
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

  const renderSectionHeader = ({ section }: { section: Section }) => {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{formatDate(section.title)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader showYearMonthNav={true} />

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {year}年{month}月の記録はありません
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
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
  },
  sectionHeader: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#666',
  },
  recordItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 80,
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  thumbnailWrapper: {
    width: '100%',
    height: '100%',
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
